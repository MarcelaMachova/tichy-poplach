// UI wiring for the Tichý poplach simulator.
// Decision logic lives in logic.js and has no DOM dependency - this file only
// turns clicks into engine calls and engine results into what the two
// simulated phones show.

import { createEngine, resolveRules } from "./logic.js";

const START_HOUR = 14;

const CONTACT_PRESETS = {
  unknown: { number: "+420733123456", name: "Neznámé číslo", contact: null },
  mama: { number: "+420601111111", name: "Máma", contact: { savedAt: -10_000_000 } },
  recent: { number: "+420602222222", name: "Nový kontakt", contact: { dynamic: true } },
  "moje-banka": { number: "+420800100100", name: "Moje banka", contact: { savedAt: -10_000_000 } },
  "bank-official": { number: "+420800100100", name: "Banka (oficiální linka)", contact: null },
};

const clockEl = document.getElementById("sim-clock");
const statusClockEls = document.querySelectorAll("[data-status-clock]");
const demoToggle = document.getElementById("demo-mode-toggle");
const resetButton = document.getElementById("reset-button");
const callNumberSelect = document.getElementById("call-number-select");
const callIncomingButton = document.getElementById("call-incoming-button");
const callOutgoingButton = document.getElementById("call-outgoing-button");
const eventBankNotification = document.getElementById("event-bank-notification");
const eventBankSms = document.getElementById("event-bank-sms");
const eventSideloadInstall = document.getElementById("event-sideload-install");
const warningOverlay = document.getElementById("warning-overlay");
const warningState = document.getElementById("warning-state");
const warningLead = document.getElementById("warning-lead");
const warningLines = document.getElementById("warning-lines");
const warningEndCall = document.getElementById("warning-end-call");
const warningCallRelative = document.getElementById("warning-call-relative");
const warningContinue = document.getElementById("warning-continue");
const warningFinal = document.querySelector(".warning-final");
const phoneBCallDismiss = document.getElementById("phone-b-call-dismiss");
const settingUserName = document.getElementById("setting-user-name");
const scenarioSelect = document.getElementById("scenario-select");
const scenarioStartButton = document.getElementById("scenario-start");
const scenarioStepButton = document.getElementById("scenario-step");
const scenarioAutoplayButton = document.getElementById("scenario-autoplay");
const scenarioStopButton = document.getElementById("scenario-stop-autoplay");
const scenarioCaptionBarText = document.getElementById("scenario-caption-text");
const phoneACursor = document.getElementById("phone-a-cursor");
const phoneBCursor = document.getElementById("phone-b-cursor");

function setScenarioCaption(text) {
  if (scenarioCaptionBarText) scenarioCaptionBarText.textContent = text;
}

async function typeScenarioCaption(text, msPerWord = 220) {
  if (!scenarioCaptionBarText) return;
  const words = text.split(" ");
  scenarioCaptionBarText.textContent = "";
  for (let i = 0; i < words.length; i++) {
    scenarioCaptionBarText.textContent = words.slice(0, i + 1).join(" ");
    await sleep(msPerWord);
  }
}

const MS_PER_WORD = 220;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readingPause(text, minMs = 600) {
  return Math.max(minMs, countWords(text) * MS_PER_WORD);
}

const phoneAWrapper = document.getElementById("phone-a-wrapper");
const phoneBWrapper = document.getElementById("phone-b-wrapper");
const scenarioCaptionBar = document.getElementById("scenario-caption-bar");

function setPhoneFocus(which) {
  if (!phoneAWrapper || !phoneBWrapper) return;
  phoneAWrapper.classList.toggle("is-focused", which === "a");
  phoneAWrapper.classList.toggle("is-dimmed", which !== "a");
  phoneBWrapper.classList.toggle("is-focused", which === "b");
  phoneBWrapper.classList.toggle("is-dimmed", which !== "b");
}

function clearPhoneFocus() {
  if (!phoneAWrapper || !phoneBWrapper) return;
  phoneAWrapper.classList.remove("is-focused", "is-dimmed");
  phoneBWrapper.classList.remove("is-focused", "is-dimmed");
}

function setCaptionFocus(active) {
  if (!scenarioCaptionBar) return;
  scenarioCaptionBar.classList.toggle("is-focused", active);
  scenarioCaptionBar.classList.toggle("is-dimmed", !active);
}

function clearCaptionFocus() {
  if (!scenarioCaptionBar) return;
  scenarioCaptionBar.classList.remove("is-focused", "is-dimmed");
}

let simSeconds = START_HOUR * 3600;
let tickHandle = null;
let rulesData = null;
let scenariosData = null;
let engine = null;
let ringingCall = null; // { key, number, name } while an incoming call has not been accepted yet
let activeCallLabel = null;
let activeCallStartTime = null;
let activeScenario = null;
let scenarioStepIndex = 0;
let autoplayTimer = null;
let autoplayActive = false;
let autoplayEpoch = 0;

function currentTime() {
  return Math.floor(simSeconds);
}

function peerLabel(preset) {
  return preset.name === "Neznámé číslo" ? preset.number : `${preset.name} (${preset.number})`;
}

function scenarioCallerLabel(step) {
  const contact = (activeScenario.contacts || []).find((c) => c.number === step.number);
  return contact ? contact.name : step.number;
}

function ensureContactRegistered(key, now) {
  const preset = CONTACT_PRESETS[key];
  if (!preset.contact) return;
  const savedAt = preset.contact.dynamic ? now - 3600 : preset.contact.savedAt;
  engine.setContact(preset.number, preset.name, savedAt);
}

// --- Simulated clock ---

function formatTime(totalSeconds, withSeconds) {
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
}

function renderClock() {
  clockEl.textContent = formatTime(simSeconds, true);
  statusClockEls.forEach((el) => {
    el.textContent = formatTime(simSeconds, false);
  });
  updateCallDuration();
}

function updateCallDuration() {
  const durationEl = document.getElementById("phone-a-call-duration");
  if (!durationEl) return;
  if (activeCallStartTime == null) {
    durationEl.textContent = "";
    return;
  }
  const elapsed = Math.max(0, currentTime() - activeCallStartTime);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  durationEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startClock() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(() => {
    simSeconds += 1;
    renderClock();
  }, 1000);
}

// --- Screen navigation ---

function showScreen(phoneId, screenName) {
  const container = document.getElementById(`${phoneId}-screen`);
  container.querySelectorAll(".screen").forEach((el) => {
    el.classList.toggle("active", el.dataset.screen === screenName);
  });
}

// --- Record (Záznam) ---

function renderRecord() {
  const list = document.getElementById("record-list");
  if (!list) return;
  list.innerHTML = "";
  const entries = engine.getLog(currentTime()).slice().reverse();
  entries.forEach((entry) => {
    const li = document.createElement("li");
    const time = document.createElement("span");
    time.className = "record-time";
    time.textContent = formatTime(entry.time, true);
    li.appendChild(time);
    li.appendChild(document.createTextNode(entry.text));
    list.appendChild(li);
  });
}

// --- Messages ---

function clearMessages() {
  document.getElementById("phone-a-messages").innerHTML = "";
  document.getElementById("phone-b-messages").innerHTML = "";
}

function pushMessage(listId, time, text) {
  const list = document.getElementById(listId);
  const li = document.createElement("li");
  const timeEl = document.createElement("span");
  timeEl.className = "record-time";
  timeEl.textContent = formatTime(time, false);
  li.appendChild(timeEl);
  li.appendChild(document.createTextNode(text));
  list.prepend(li);
}

function deliverAlarmSms(time) {
  const name = settingUserName.value.trim() || "Uživatelka";
  const text =
    `Tichý poplach: ${name} možná právě mluví s podvodníkem. Zkuste ji ihned kontaktovat ` +
    "a zabránit škodám. Pokud došlo k pokusu o podvod, nahlaste ho na policii.";
  pushMessage("phone-b-messages", time, text);
}

// --- Warning overlay (5.6) ---

const WARNING_BULLET_TEXTS = [
  "Banka nebo policie po vás nikdy nechce převést peníze na \"bezpečný účet\", vybrat hotovost a předat ji kurýrovi, sdělit přihlašovací údaje, údaje z karty, PIN, anebo kód ze SMS.",
  "Nebude na vás ani vyvíjet nátlak, abyste reagovali okamžitě.",
  "Pravý bankéř vám nabídne ověření jeho totožnosti, přes oficiální aplikaci banky.",
];

let lastWarningReadingDelay = 0;

function showWarning(result) {
  warningState.textContent = result.alarmPhase ? "🚨 Poplach" : "⚠️ Pozor";
  warningOverlay.classList.toggle("phase-warn", !result.alarmPhase);

  const leadParts = [];
  if (result.alarmPhase) leadParts.push("Poslali jsme zprávu vašemu blízkému.");
  if (result.signal === "bank-notification" || result.signal === "bank-sms") {
    leadParts.push(
      "Právě vám píše banka, zatímco telefonujete s neznámým číslem. Buďte opatrní."
    );
  }
  warningLead.textContent = leadParts.join(" ");

  warningLines.innerHTML = "";
  WARNING_BULLET_TEXTS.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    warningLines.appendChild(li);
  });

  warningEndCall.style.display = engine.getState().hasActiveCall ? "inline-block" : "none";
  warningOverlay.classList.add("active");

  const warningText = [warningState.textContent, ...leadParts, ...WARNING_BULLET_TEXTS, warningFinal?.textContent || ""].join(" ");
  lastWarningReadingDelay = readingPause(warningText, 2200);
}

function hideWarning() {
  warningOverlay.classList.remove("active");
}

function handleResult(result, now) {
  renderRecord();
  if (!result) return;
  if (result.warning) showWarning(result);
  if (result.smsSent) deliverAlarmSms(now);
}

// --- Phone A: call screen ---

function renderCallScreenRinging() {
  document.getElementById("phone-a-call-status").textContent = "Příchozí hovor";
  document.getElementById("phone-a-call-peer").textContent = peerLabel(
    CONTACT_PRESETS[ringingCall.key]
  );
  const actions = document.getElementById("phone-a-call-actions");
  actions.innerHTML = "";

  const acceptBtn = document.createElement("button");
  acceptBtn.textContent = "Přijmout";
  acceptBtn.addEventListener("click", acceptRingingCall);

  const declineBtn = document.createElement("button");
  declineBtn.textContent = "Odmítnout";
  declineBtn.addEventListener("click", declineRingingCall);

  actions.append(acceptBtn, declineBtn);
}

function renderCallScreenActive() {
  document.getElementById("phone-a-call-status").textContent = "Hovor probíhá";
  document.getElementById("phone-a-call-peer").textContent = activeCallLabel;
  const actions = document.getElementById("phone-a-call-actions");
  actions.innerHTML = "";

  const hangupBtn = document.createElement("button");
  hangupBtn.textContent = "Zavěsit";
  hangupBtn.addEventListener("click", hangUpActiveCall);
  actions.append(hangupBtn);
  updateCallDuration();
}

function renderCallScreenIdle() {
  document.getElementById("phone-a-call-status").textContent = "Žádný hovor";
  document.getElementById("phone-a-call-peer").textContent = "";
  document.getElementById("phone-a-call-actions").innerHTML = "";
  updateCallDuration();
}

function renderScenarioRingingPreview(peerText) {
  document.getElementById("phone-a-call-status").textContent = "Příchozí hovor";
  document.getElementById("phone-a-call-peer").textContent = peerText;
  const actions = document.getElementById("phone-a-call-actions");
  actions.innerHTML = "";
  const acceptBtn = document.createElement("button");
  acceptBtn.textContent = "Přijmout";
  const declineBtn = document.createElement("button");
  declineBtn.textContent = "Odmítnout";
  actions.append(acceptBtn, declineBtn);
}

function acceptRingingCall() {
  const now = currentTime();
  const preset = CONTACT_PRESETS[ringingCall.key];
  ensureContactRegistered(ringingCall.key, now);
  engine.startCall({ number: preset.number, direction: "incoming", time: now });
  activeCallLabel = peerLabel(preset);
  activeCallStartTime = now;
  ringingCall = null;
  renderCallScreenActive();
  renderRecord();
}

function declineRingingCall() {
  ringingCall = null;
  showScreen("phone-a", "home");
}

function hangUpActiveCall() {
  const now = currentTime();
  engine.endCall(now);
  activeCallLabel = null;
  activeCallStartTime = null;
  renderRecord();
  showScreen("phone-a", "home");
}

function openBankApp() {
  showScreen("phone-a", "bank");
  const now = currentTime();
  const result = engine.openApp("testovaci-banka", now);
  handleResult(result, now);
}

// --- Scénáře (5.9) ---

const SCENARIO_CATEGORY_LABELS = { fraud: "[Podvod]", benign: "[Běžné]", demo: "★ Doporučeno" };

function runTrigger(trigger, now) {
  switch (trigger.type) {
    case "open-app":
      return engine.openApp(trigger.app, now);
    case "install":
      return engine.installAppOutsideStore(now);
    case "bank-notification":
      return engine.receiveBankNotification(trigger.sender, now);
    case "bank-sms":
      return engine.receiveSms(trigger.sender, now);
    default:
      return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hideCursor(cursorEl) {
  cursorEl.classList.remove("visible", "pressed");
}

async function tapElement(cursorEl, screenContainerId, targetEl) {
  if (!targetEl) return;
  const screen = document.getElementById(screenContainerId);
  const screenRect = screen.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  cursorEl.style.left = `${targetRect.left + targetRect.width / 2 - screenRect.left}px`;
  cursorEl.style.top = `${targetRect.top + targetRect.height / 2 - screenRect.top}px`;
  cursorEl.classList.add("visible");
  await sleep(900);
  cursorEl.classList.add("pressed");
  targetEl.classList.add("tap-highlight");
  await sleep(400);
  targetEl.classList.remove("tap-highlight");
  cursorEl.classList.remove("pressed");
  await sleep(500);
}

async function goHomeWithTap(phoneId, cursorEl) {
  const activeScreen = document.querySelector(`#${phoneId}-screen .screen.active`);
  if (activeScreen && activeScreen.dataset.screen !== "home") {
    const backBtn = activeScreen.querySelector("[data-back]");
    if (backBtn) await tapElement(cursorEl, `${phoneId}-screen`, backBtn);
  }
  showScreen(phoneId, "home");
  hideCursor(cursorEl);
}

function populateScenarioSelect() {
  scenariosData.scenarios
    .filter((s) => s.inPlayer)
    .sort((a, b) => (a.category === "demo" ? -1 : b.category === "demo" ? 1 : 0))
    .forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${SCENARIO_CATEGORY_LABELS[s.category] || ""} ${s.title}`;
      scenarioSelect.appendChild(opt);
    });
}

function stopAutoplay() {
  autoplayActive = false;
  autoplayEpoch += 1;
  if (autoplayTimer) {
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }
}

function startScenario() {
  stopAutoplay();
  const scenario = scenariosData.scenarios.find((s) => s.id === scenarioSelect.value);
  if (!scenario) return;
  if (typeof scenario.forceDemoMode === "boolean") {
    demoToggle.checked = scenario.forceDemoMode;
  }
  resetSimulation();
  activeScenario = { ...scenario, steps: [...scenario.steps].sort((a, b) => a.time - b.time) };
  (activeScenario.contacts || []).forEach((c) => engine.setContact(c.number, c.name, c.savedAt));
  scenarioStepIndex = 0;
  setScenarioCaption(`${activeScenario.title} — připraveno, klikněte na „Další krok“ nebo „Přehrát automaticky“.`);
}

async function applyScenarioStep(step) {
  simSeconds = START_HOUR * 3600 + step.time;
  renderClock();
  const now = currentTime();
  setCaptionFocus(true);
  setPhoneFocus(null);
  await typeScenarioCaption(step.caption);
  await sleep(readingPause(step.caption));
  setCaptionFocus(false);
  setPhoneFocus(step.focus || "a");
  let result = null;

  switch (step.type) {
    case "call":
      if (step.direction === "incoming") {
        showScreen("phone-a", "call");
        renderScenarioRingingPreview(scenarioCallerLabel(step));
        await sleep(1500);
        const acceptBtn = document.querySelector("#phone-a-call-actions button");
        await tapElement(phoneACursor, "phone-a-screen", acceptBtn);
      }
      engine.startCall({ number: step.number, direction: step.direction, time: now });
      activeCallLabel = scenarioCallerLabel(step);
      activeCallStartTime = now;
      showScreen("phone-a", "call");
      renderCallScreenActive();
      hideCursor(phoneACursor);
      break;
    case "call-end": {
      showScreen("phone-a", "call");
      const hangupBtn = document.querySelector("#phone-a-call-actions button");
      await tapElement(phoneACursor, "phone-a-screen", hangupBtn);
      engine.endCall(now);
      activeCallLabel = null;
      activeCallStartTime = null;
      showScreen("phone-a", "home");
      hideCursor(phoneACursor);
      break;
    }
    case "open-app": {
      await goHomeWithTap("phone-a", phoneACursor);
      const bankIcon = document.querySelector('#phone-a-screen .app-icon[data-app="banka"]');
      await tapElement(phoneACursor, "phone-a-screen", bankIcon);
      showScreen("phone-a", "bank");
      hideCursor(phoneACursor);
      await sleep(1200);
      if (!step.deferTrigger) {
        result = engine.openApp(step.app, now);
      }
      break;
    }
    case "bank-notification":
      if (!step.deferTrigger) {
        result = engine.receiveBankNotification(step.sender, now);
      }
      break;
    case "bank-sms":
      pushMessage("phone-a-messages", now, step.body || `Zpráva od ${step.sender}`);
      if (!step.deferTrigger) {
        result = engine.receiveSms(step.sender, now);
      }
      break;
    case "install": {
      await goHomeWithTap("phone-a", phoneACursor);
      const messagesIcon = document.querySelector('#phone-a-screen .app-icon[data-app="zpravy"]');
      await tapElement(phoneACursor, "phone-a-screen", messagesIcon);
      showScreen("phone-a", "zpravy");
      hideCursor(phoneACursor);
      await sleep(1200);
      const linkMessage = document.querySelector("#phone-a-messages li");
      await tapElement(phoneACursor, "phone-a-screen", linkMessage);
      hideCursor(phoneACursor);
      if (!step.deferTrigger) {
        result = engine.installAppOutsideStore(now);
      }
      break;
    }
    case "narrate":
      // vypravěčská pauza; pokud nese "trigger", teprve teď se vyhodnotí odložený signál
      if (step.trigger) {
        result = runTrigger(step.trigger, now);
      }
      break;
    case "continue": {
      await tapElement(phoneACursor, "phone-a-screen", warningContinue);
      hideCursor(phoneACursor);
      warningContinue.click();
      break;
    }
    case "show-message-b": {
      const zpravyIconB = document.querySelector('#phone-b-screen .app-icon[data-app="zpravy"]');
      await tapElement(phoneBCursor, "phone-b-screen", zpravyIconB);
      showScreen("phone-b", "zpravy");
      hideCursor(phoneBCursor);
      await sleep(1200);
      const smsItemB = document.querySelector("#phone-b-messages li");
      await tapElement(phoneBCursor, "phone-b-screen", smsItemB);
      hideCursor(phoneBCursor);
      break;
    }
    case "show-record": {
      await goHomeWithTap("phone-a", phoneACursor);
      const tpIcon = document.querySelector('#phone-a-screen .app-icon[data-app="tichy-poplach"]');
      await tapElement(phoneACursor, "phone-a-screen", tpIcon);
      showScreen("phone-a", "tichy-poplach");
      hideCursor(phoneACursor);
      await sleep(900);
      const recordTabBtn = document.querySelector('[data-tp-tab="zaznam"]');
      await tapElement(phoneACursor, "phone-a-screen", recordTabBtn);
      document.querySelectorAll("[data-tp-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tpTab === "zaznam"));
      document
        .querySelectorAll("[data-tp-panel]")
        .forEach((p) => p.classList.toggle("active", p.dataset.tpPanel === "zaznam"));
      hideCursor(phoneACursor);
      renderRecord();
      break;
    }
  }

  handleResult(result, now);
  return result;
}

let stepInProgress = false;

async function stepScenario() {
  if (!activeScenario || stepInProgress) return null;
  if (scenarioStepIndex >= activeScenario.steps.length) {
    setScenarioCaption("Scénář dokončen.");
    clearPhoneFocus();
    clearCaptionFocus();
    return null;
  }
  const step = activeScenario.steps[scenarioStepIndex];
  scenarioStepIndex += 1;
  stepInProgress = true;
  try {
    return await applyScenarioStep(step);
  } catch (err) {
    console.error(`Scénář: chyba v kroku ${scenarioStepIndex} (type: "${step.type}")`, err);
    setScenarioCaption(`Chyba v kroku "${step.type}" - podrobnosti v konzoli prohlížeče (F12).`);
    throw err;
  } finally {
    stepInProgress = false;
  }
}

async function autoplayNext() {
  const myEpoch = autoplayEpoch;
  if (!autoplayActive || !activeScenario || scenarioStepIndex >= activeScenario.steps.length) {
    autoplayTimer = null;
    if (autoplayActive && activeScenario) {
      setScenarioCaption("Scénář dokončen.");
      clearPhoneFocus();
      clearCaptionFocus();
    }
    autoplayActive = false;
    return;
  }
  const result = await stepScenario();
  if (!autoplayActive || autoplayEpoch !== myEpoch) return;
  const manualContinue = activeScenario && activeScenario.manualContinue;
  const warningShowing = result && result.warning;
  const readDelay = warningShowing ? lastWarningReadingDelay : 2200;
  autoplayTimer = setTimeout(async () => {
    if (!autoplayActive || autoplayEpoch !== myEpoch) return;
    if (warningShowing && !manualContinue) {
      await tapElement(phoneACursor, "phone-a-screen", warningContinue);
      if (!autoplayActive || autoplayEpoch !== myEpoch) return;
      hideCursor(phoneACursor);
      warningContinue.click();
    }
    if (autoplayEpoch !== myEpoch) return;
    autoplayTimer = setTimeout(() => {
      if (autoplayEpoch !== myEpoch) return;
      autoplayNext();
    }, 1000);
  }, readDelay);
}

// --- Reset / init ---

function resetSimulation() {
  stopAutoplay();
  activeScenario = null;
  scenarioStepIndex = 0;
  setScenarioCaption("Vyberte scénář a klikněte na „Přehrát od začátku“.");
  clearPhoneFocus();
  clearCaptionFocus();

  simSeconds = START_HOUR * 3600;
  renderClock();

  const rules = resolveRules(rulesData, demoToggle.checked);
  engine = createEngine(rules);
  engine.setContact(
    CONTACT_PRESETS.mama.number,
    CONTACT_PRESETS.mama.name,
    CONTACT_PRESETS.mama.contact.savedAt
  );
  engine.setContact(
    CONTACT_PRESETS["moje-banka"].number,
    CONTACT_PRESETS["moje-banka"].name,
    CONTACT_PRESETS["moje-banka"].contact.savedAt
  );

  ringingCall = null;
  activeCallLabel = null;
  activeCallStartTime = null;
  clearMessages();
  hideWarning();
  showScreen("phone-a", "home");
  showScreen("phone-b", "home");
  renderRecord();
  startClock();
}

function wireEvents() {
  demoToggle.addEventListener("change", resetSimulation);
  resetButton.addEventListener("click", resetSimulation);

  callIncomingButton.addEventListener("click", () => {
    ringingCall = { key: callNumberSelect.value };
    showScreen("phone-a", "call");
    renderCallScreenRinging();
  });

  callOutgoingButton.addEventListener("click", () => {
    const now = currentTime();
    const key = callNumberSelect.value;
    const preset = CONTACT_PRESETS[key];
    ensureContactRegistered(key, now);
    engine.startCall({ number: preset.number, direction: "outgoing", time: now });
    activeCallLabel = peerLabel(preset);
    activeCallStartTime = now;
    showScreen("phone-a", "call");
    renderCallScreenActive();
    renderRecord();
  });

  eventBankNotification.addEventListener("click", () => {
    const now = currentTime();
    const result = engine.receiveBankNotification("Mobilní banka", now);
    handleResult(result, now);
  });

  eventBankSms.addEventListener("click", () => {
    const now = currentTime();
    pushMessage("phone-a-messages", now, "Zpráva od TestBanka");
    const result = engine.receiveSms("TestBanka", now);
    handleResult(result, now);
  });

  eventSideloadInstall.addEventListener("click", () => {
    const now = currentTime();
    const result = engine.installAppOutsideStore(now);
    handleResult(result, now);
  });

  warningEndCall.addEventListener("click", () => {
    const now = currentTime();
    engine.endCall(now);
    activeCallLabel = null;
    hideWarning();
    renderRecord();
    showScreen("phone-a", "home");
  });

  warningCallRelative.addEventListener("click", () => {
    const name = settingUserName.value.trim() || "Uživatelka";
    showScreen("phone-b", "call");
    document.getElementById("phone-b-call-status").textContent = "Příchozí hovor";
    document.getElementById("phone-b-call-peer").textContent = name;
  });

  warningContinue.addEventListener("click", () => {
    const now = currentTime();
    const result = engine.continueClicked(now);
    renderRecord();
    if (result.smsSentNow) {
      deliverAlarmSms(now);
      showWarning({ warning: true, alarmPhase: true, signal: null });
    } else {
      hideWarning();
    }
  });

  phoneBCallDismiss.addEventListener("click", () => {
    showScreen("phone-b", "home");
  });

  document.querySelectorAll("#phone-a-screen .app-icon").forEach((icon) => {
    icon.addEventListener("click", () => {
      const app = icon.dataset.app;
      if (app === "banka") return openBankApp();
      if (app === "zpravy") return showScreen("phone-a", "zpravy");
      if (app === "tichy-poplach") {
        showScreen("phone-a", "tichy-poplach");
        renderRecord();
        return;
      }
      if (app === "telefon") {
        showScreen("phone-a", "call");
        if (!engine.getState().hasActiveCall && !ringingCall) renderCallScreenIdle();
        return;
      }
    });
  });

  document.querySelectorAll("#phone-b-screen .app-icon").forEach((icon) => {
    icon.addEventListener("click", () => {
      const app = icon.dataset.app;
      if (app === "zpravy") return showScreen("phone-b", "zpravy");
      if (app === "telefon") return showScreen("phone-b", "call");
    });
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const screenEl = btn.closest(".phone-screen");
      const phoneId = screenEl.id.replace("-screen", "");
      showScreen(phoneId, "home");
    });
  });

  document.querySelectorAll("[data-tp-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tp-tab]").forEach((b) => b.classList.toggle("active", b === btn));
      document
        .querySelectorAll("[data-tp-panel]")
        .forEach((p) => p.classList.toggle("active", p.dataset.tpPanel === btn.dataset.tpTab));
      if (btn.dataset.tpTab === "zaznam") renderRecord();
    });
  });

  scenarioStartButton.addEventListener("click", startScenario);
  scenarioStepButton.addEventListener("click", () => stepScenario());
  scenarioAutoplayButton.addEventListener("click", () => {
    if (!activeScenario) startScenario();
    stopAutoplay();
    autoplayActive = true;
    autoplayNext();
  });
  scenarioStopButton.addEventListener("click", stopAutoplay);
}

async function init() {
  const [rulesResponse, scenariosResponse] = await Promise.all([
    fetch("./data/rules.json"),
    fetch("./data/scenarios.json"),
  ]);
  rulesData = await rulesResponse.json();
  scenariosData = await scenariosResponse.json();
  populateScenarioSelect();
  resetSimulation();
  wireEvents();
}

init();
