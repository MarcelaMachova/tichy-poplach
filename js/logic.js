// Decision logic for the Tichý poplach simulator (unauthenticated calls, strong signals, long calls).
// Pure module, no DOM dependency - used by the browser UI and by node --test.
// Time is always an integer number of seconds since an arbitrary simulation start.

export function resolveRules(rulesData, demoMode) {
  const timers = demoMode ? rulesData.timers.demo : rulesData.timers.normal;
  return {
    ...timers,
    institutionNumbers: rulesData.institutionNumbers,
    bankOfficialNumbers: rulesData.bankOfficialNumbers,
    bankApps: rulesData.bankApps,
    bankNotificationSenders: rulesData.bankNotificationSenders,
    bankSmsSenders: rulesData.bankSmsSenders,
  };
}

export function createEngine(rules) {
  const contacts = new Map(); // number -> { name, savedAt }
  const calls = [];
  let nextCallId = 1;
  let activeCallId = null;
  let incident = null; // { smsSent, awaitingContinue, armedForAlarm }
  const log = [];

  function addLogEntry(time, text) {
    log.push({ time, text });
  }

  function setContact(number, name, savedAt) {
    contacts.set(number, { name, savedAt });
  }

  function isInstitutionNumber(number) {
    return rules.institutionNumbers.includes(number);
  }

  function isBankOfficialNumber(number) {
    return rules.bankOfficialNumbers.includes(number);
  }

  function isUnverifiedCall(number, direction, time) {
    if (direction === "outgoing" && isBankOfficialNumber(number)) return false;
    const contact = contacts.get(number);
    if (!contact) return true;
    if (isInstitutionNumber(number)) return true;
    if (time - contact.savedAt < rules.newContactThresholdSec) return true;
    return false;
  }

  function callDuration(call, atTime) {
    const end = call.end != null ? call.end : atTime;
    return Math.max(0, end - call.start);
  }

  function hasUnverifiedCallContext(atTime) {
    return calls.some(
      (c) => c.unverified && (c.end == null || atTime - c.end <= rules.postCallContextWindowSec)
    );
  }

  function anyUnverifiedCallLongerThan(atTime, thresholdSec) {
    return calls.some((c) => c.unverified && callDuration(c, atTime) > thresholdSec);
  }

  function sumUnverifiedDurationInWindow(atTime, windowSec) {
    const windowStart = atTime - windowSec;
    let sum = 0;
    for (const call of calls) {
      if (!call.unverified) continue;
      const callEnd = call.end != null ? call.end : atTime;
      const overlapStart = Math.max(call.start, windowStart);
      const overlapEnd = Math.min(callEnd, atTime);
      if (overlapEnd > overlapStart) sum += overlapEnd - overlapStart;
    }
    return sum;
  }

  function hasConsecutiveRiskyCalls(atTime) {
    for (let i = 0; i < calls.length - 1; i++) {
      const a = calls[i];
      const b = calls[i + 1];
      if (!a.unverified || !b.unverified) continue;
      if (a.number === b.number) continue;
      if (a.end == null) continue;
      const aDuration = callDuration(a, a.end);
      const bDuration = callDuration(b, atTime);
      const gap = b.start - a.end;
      if (
        aDuration > rules.consecutiveCallMinDurationSec &&
        bDuration > rules.consecutiveCallMinDurationSec &&
        gap >= 0 &&
        gap <= rules.consecutiveCallGapMaxSec
      ) {
        return true;
      }
    }
    return false;
  }

  function isCallLongEnoughForBankSignal(atTime) {
    return (
      anyUnverifiedCallLongerThan(atTime, rules.bankAppForegroundThresholdSec) ||
      sumUnverifiedDurationInWindow(atTime, rules.bankSignalWindowSec) >
        rules.bankAppForegroundThresholdSec
    );
  }

  function isLongCallRiskActive(atTime) {
    return (
      anyUnverifiedCallLongerThan(atTime, rules.longCallThresholdSec) ||
      sumUnverifiedDurationInWindow(atTime, rules.longCallSumWindowSec) >
        rules.longCallSumThresholdSec ||
      hasConsecutiveRiskyCalls(atTime)
    );
  }

  function maybeExpireIncident(time) {
    if (!incident) return;
    if (activeCallId != null) return;
    const endedUnverifiedCalls = calls.filter((c) => c.unverified && c.end != null);
    if (endedUnverifiedCalls.length === 0) {
      incident = null;
      return;
    }
    const lastEnd = Math.max(...endedUnverifiedCalls.map((c) => c.end));
    if (time - lastEnd > rules.postCallContextWindowSec) {
      incident = null;
    }
  }

  function startCall({ number, direction, time }) {
    maybeExpireIncident(time);
    const unverified = isUnverifiedCall(number, direction, time);
    const call = { id: nextCallId++, number, direction, start: time, end: null, unverified };
    calls.push(call);
    activeCallId = call.id;
    addLogEntry(
      time,
      `${direction === "incoming" ? "Příchozí" : "Odchozí"} hovor (${number})` +
        (unverified ? " – neověřený hovor" : "")
    );
    return call.id;
  }

  function endCall(time) {
    const call = calls.find((c) => c.id === activeCallId);
    if (call) {
      call.end = time;
      addLogEntry(time, `Hovor ukončen (${call.number})`);
    }
    activeCallId = null;
    maybeExpireIncident(time);
    return call ? call.id : null;
  }

  function handleStrongSignal(type, label, time, requiresDurationCheck) {
    maybeExpireIncident(time);

    if (!hasUnverifiedCallContext(time)) {
      return { warning: false };
    }
    if (requiresDurationCheck && !isCallLongEnoughForBankSignal(time)) {
      return { warning: false };
    }

    addLogEntry(time, `Silný signál: ${label}`);

    if (!incident) {
      incident = { smsSent: false, awaitingContinue: true, armedForAlarm: false };
      addLogEntry(time, "Zobrazeno varování (1. fáze)");
      return { warning: true, alarmPhase: false, smsSent: false, signal: type };
    }

    if (!incident.smsSent && incident.armedForAlarm) {
      incident.smsSent = true;
      incident.armedForAlarm = false;
      incident.awaitingContinue = true;
      addLogEntry(time, "Zobrazeno varování (poplach) a odeslána SMS blízkému");
      return { warning: true, alarmPhase: true, smsSent: true, signal: type };
    }

    incident.awaitingContinue = true;
    addLogEntry(time, "Zobrazeno varování (opakovaně)");
    return { warning: true, alarmPhase: false, smsSent: false, signal: type };
  }

  function openApp(appId, time) {
    const isBankApp = rules.bankApps.includes(appId);
    addLogEntry(time, `Otevřena aplikace: ${appId}`);
    if (!isBankApp) return { warning: false };
    return handleStrongSignal("bank-app", "bankovní aplikace v popředí", time, true);
  }

  function receiveBankNotification(sender, time) {
    const isBank = rules.bankNotificationSenders.includes(sender);
    addLogEntry(time, `Notifikace od: ${sender}`);
    if (!isBank) return { warning: false };
    return handleStrongSignal("bank-notification", "notifikace od banky", time, true);
  }

  function receiveSms(sender, time) {
    const isBank = rules.bankSmsSenders.includes(sender);
    addLogEntry(time, `SMS od: ${sender}`);
    if (!isBank) return { warning: false };
    return handleStrongSignal("bank-sms", "SMS od banky", time, true);
  }

  function installAppOutsideStore(time) {
    addLogEntry(time, "Instalace aplikace mimo Google Play");
    return handleStrongSignal("install", "instalace aplikace mimo Google Play", time, false);
  }

  function continueClicked(time) {
    if (!incident) return { smsSentNow: false };
    incident.awaitingContinue = false;

    if (!incident.smsSent && isLongCallRiskActive(time)) {
      incident.smsSent = true;
      incident.armedForAlarm = false;
      addLogEntry(time, "Pokračovat (dlouhý hovor) – odeslána SMS blízkému ihned");
      return { smsSentNow: true };
    }

    incident.armedForAlarm = true;
    addLogEntry(time, "Pokračovat – čeká se na další silný signál");
    return { smsSentNow: false };
  }

  function getState() {
    return {
      hasActiveCall: activeCallId != null,
      incidentActive: incident != null,
      awaitingContinue: incident ? incident.awaitingContinue : false,
      smsSent: incident ? incident.smsSent : false,
    };
  }

  function getCalls() {
    return calls.map((c) => ({ ...c }));
  }

  function getLog(nowTime) {
    if (nowTime == null) return log.slice();
    return log.filter((entry) => nowTime - entry.time <= rules.recordRetentionSec);
  }

  return {
    setContact,
    startCall,
    endCall,
    openApp,
    receiveBankNotification,
    receiveSms,
    installAppOutsideStore,
    continueClicked,
    getState,
    getCalls,
    getLog,
    isLongCallRiskActive,
  };
}
