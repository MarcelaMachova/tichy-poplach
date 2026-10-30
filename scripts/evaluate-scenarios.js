// Laboratorní test fraud/benign scénářů. Samostatný vyhodnocovací skript,
// ne unit test - měří, nekontroluje "prošlo/neprošlo". Spouští se:
//   node scripts/evaluate-scenarios.js
//
// Počítá s nejhorším případem: uživatelka podvodníkovi věří a na každé
// varování klepne na Pokračovat. Používá NORMÁLNÍ (ne demo) časy z
// rules.json, protože hodnotí skutečné chování navrženého produktu.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createEngine, resolveRules } from "../js/logic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const rulesData = JSON.parse(readFileSync(path.join(root, "data", "rules.json"), "utf8"));
const scenariosData = JSON.parse(readFileSync(path.join(root, "data", "scenarios.json"), "utf8"));
const rules = resolveRules(rulesData, false);

function runScenario(scenario) {
  const engine = createEngine(rules);
  (scenario.contacts || []).forEach((c) => engine.setContact(c.number, c.name, c.savedAt));

  const state = { caught: false, caughtAtStepIndex: null, caughtAtTime: null, smsSent: false, warningCount: 0 };
  const steps = [...scenario.steps].sort((a, b) => a.time - b.time);

  steps.forEach((step, index) => {
    let result = null;
    switch (step.type) {
      case "call":
        engine.startCall({ number: step.number, direction: step.direction, time: step.time });
        return;
      case "call-end":
        engine.endCall(step.time);
        return;
      case "open-app":
        result = engine.openApp(step.app, step.time);
        break;
      case "bank-notification":
        result = engine.receiveBankNotification(step.sender, step.time);
        break;
      case "bank-sms":
        result = engine.receiveSms(step.sender, step.time);
        break;
      case "install":
        result = engine.installAppOutsideStore(step.time);
        break;
      case "show-record":
        return;
      case "show-message-b":
        return;
      case "narrate":
        return;
      case "continue":
        return;
      default:
        throw new Error(`Scénář ${scenario.id}: neznámý typ kroku "${step.type}"`);
    }

    if (result && result.warning) {
      state.warningCount += 1;
      if (!state.caught) {
        state.caught = true;
        state.caughtAtStepIndex = index;
        state.caughtAtTime = step.time;
      }
      if (result.smsSent) state.smsSent = true;

      // Nejhorší případ: uživatelka věří a hned klepne na Pokračovat.
      const afterContinue = engine.continueClicked(step.time);
      if (afterContinue.smsSentNow) state.smsSent = true;
    }
  });

  return state;
}

const results = scenariosData.scenarios.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  category: scenario.category,
  limitationNote: scenario.limitationNote || null,
  ...runScenario(scenario),
}));

const fraud = results.filter((r) => r.category === "fraud");
const benign = results.filter((r) => r.category === "benign");

function describe(r) {
  const location = r.caught ? ` (krok ${r.caughtAtStepIndex + 1}, t=${r.caughtAtTime} s, SMS: ${r.smsSent ? "ano" : "ne"})` : "";
  const note = r.limitationNote ? `  [${r.limitationNote}]` : "";
  return `${r.id} - ${r.title}${location}${note}`;
}

console.log("=== Podvodné scénáře ===");
fraud.forEach((r) => console.log(`${r.caught ? "ZACHYCENO   " : "NEZACHYCENO "}${describe(r)}`));

console.log("\n=== Běžné situace ===");
benign.forEach((r) => console.log(`${r.caught ? "PLANÝ POPLACH" : "beze změny   "}${describe(r)}`));

const fraudCaught = fraud.filter((r) => r.caught).length;
const fraudWithSms = fraud.filter((r) => r.smsSent).length;
const falseAlarms = benign.filter((r) => r.caught).length;
const falseAlarmsWithSms = benign.filter((r) => r.caught && r.smsSent).length;

console.log("\n=== Souhrn ===");
console.log(`Podvodné scénáře zachyceny: ${fraudCaught} / ${fraud.length}`);
console.log(`Z toho odešel i SMS poplach: ${fraudWithSms} / ${fraud.length}`);
console.log(`Planých poplachů v běžných situacích: ${falseAlarms} / ${benign.length}`);
console.log(`Z toho s odesláním SMS: ${falseAlarmsWithSms} / ${benign.length}`);
