import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createEngine, resolveRules } from "../js/logic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesData = JSON.parse(
  readFileSync(path.join(__dirname, "..", "data", "rules.json"), "utf8")
);
const demoRules = resolveRules(rulesData, true);
const normalRules = resolveRules(rulesData, false);

function newEngine(demo = true) {
  return createEngine(demo ? demoRules : normalRules);
}

// --- 5.3 Neověřený hovor ---

test("5.3 - číslo mimo kontakty je neověřené", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700111222", direction: "incoming", time: 0 });
  assert.equal(engine.getCalls()[0].unverified, true);
});

test("5.3 - starý uložený kontakt je ověřený", () => {
  const engine = newEngine();
  engine.setContact("+420600111222", "Máma", -1_000_000);
  engine.startCall({ number: "+420600111222", direction: "incoming", time: 0 });
  assert.equal(engine.getCalls()[0].unverified, false);
});

test("5.3 - uložený kontakt s číslem instituce zůstává neověřený", () => {
  const engine = newEngine();
  engine.setContact("+420800100100", "Moje banka", -1_000_000);
  engine.startCall({ number: "+420800100100", direction: "incoming", time: 0 });
  assert.equal(engine.getCalls()[0].unverified, true);
});

test("5.3 - kontakt uložený před méně než 24 h zůstává neověřený", () => {
  const engine = newEngine();
  engine.setContact("+420600999888", "Nový kontakt", 0);
  engine.startCall({ number: "+420600999888", direction: "incoming", time: 3600 });
  assert.equal(engine.getCalls()[0].unverified, true);
});

test("5.3 - kontakt uložený před více než 24 h je ověřený", () => {
  const engine = newEngine();
  engine.setContact("+420600999888", "Starší kontakt", 0);
  engine.startCall({ number: "+420600999888", direction: "incoming", time: 90_000 });
  assert.equal(engine.getCalls()[0].unverified, false);
});

test("5.3 - odchozí hovor na oficiální číslo banky není neověřený", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420800100100", direction: "outgoing", time: 0 });
  assert.equal(engine.getCalls()[0].unverified, false);
});

test("5.3 - odchozí hovor na jiné neuložené číslo je neověřený", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700333444", direction: "outgoing", time: 0 });
  assert.equal(engine.getCalls()[0].unverified, true);
});

// --- 5.4 Silné signály ---

test("5.4 - bankovní aplikace v popředí potřebuje dost dlouhý neověřený hovor", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000000", direction: "incoming", time: 0 });
  const tooEarly = engine.openApp("testovaci-banka", 5);
  assert.equal(tooEarly.warning, false);
  const longEnough = engine.openApp("testovaci-banka", 12);
  assert.equal(longEnough.warning, true);
  assert.equal(longEnough.alarmPhase, false);
});

test("5.4 - instalace mimo Google Play varuje okamžitě", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000000", direction: "incoming", time: 0 });
  const result = engine.installAppOutsideStore(1);
  assert.equal(result.warning, true);
});

test("5.4 - bez kontextu neověřeného hovoru žádné varování", () => {
  const engine = newEngine();
  const result = engine.openApp("testovaci-banka", 1000);
  assert.equal(result.warning, false);
});

test("5.4 - ověřený hovor nikdy nespustí varování", () => {
  const engine = newEngine();
  engine.setContact("+420600111222", "Máma", -1_000_000);
  engine.startCall({ number: "+420600111222", direction: "incoming", time: 0 });
  const result = engine.openApp("testovaci-banka", 20);
  assert.equal(result.warning, false);
});

test("5.4 - SMS od banky je silný signál, notifikace od jiného odesílatele ne", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000000", direction: "incoming", time: 0 });
  const other = engine.receiveSms("NejakaFirma", 12);
  assert.equal(other.warning, false);
  const bank = engine.receiveSms("TestBanka", 13);
  assert.equal(bank.warning, true);
});

// --- 5.6 Zásah: varování -> Pokračovat -> poplach ---

test("5.6 - varování, Pokračovat, další signál pošle jeden poplach", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000000", direction: "incoming", time: 0 });

  const first = engine.openApp("testovaci-banka", 12);
  assert.equal(first.warning, true);
  assert.equal(first.alarmPhase, false);

  const afterContinue = engine.continueClicked(12);
  assert.equal(afterContinue.smsSentNow, false);

  const second = engine.openApp("testovaci-banka", 13);
  assert.equal(second.warning, true);
  assert.equal(second.alarmPhase, true);
  assert.equal(second.smsSent, true);
  assert.equal(engine.getState().smsSent, true);

  engine.continueClicked(13);
  const third = engine.receiveBankNotification("Mobilní banka", 14);
  assert.equal(third.warning, true);
  assert.equal(third.alarmPhase, false);
  assert.equal(third.smsSent, false, "na jednu podezřelou situaci jen jeden poplach");
});

// --- 5.5 Dlouhý hovor (zvýšené riziko) ---

test("5.5(a) - jeden dlouhý hovor pošle poplach hned po Pokračovat", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000000", direction: "incoming", time: 0 });
  const warn = engine.openApp("testovaci-banka", 70); // demo: 60 s = dlouhý hovor
  assert.equal(warn.warning, true);
  assert.equal(warn.alarmPhase, false);
  const result = engine.continueClicked(70);
  assert.equal(result.smsSentNow, true);
});

test("5.5(b) - součet neověřených hovorů nad limitem za poslední 2 h (demo 2 min)", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000001", direction: "incoming", time: 0 });
  engine.endCall(30); // hovor 1: 30 s
  assert.equal(engine.isLongCallRiskActive(35), false);

  engine.startCall({ number: "+420700000001", direction: "incoming", time: 40 });
  engine.endCall(61); // hovor 2: 21 s, součet 51 s nad limitem 45 s
  assert.equal(engine.isLongCallRiskActive(61), true);
});

test("5.5(c) - dva navazující neověřené hovory z různých čísel (bankéř, pak policista)", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000001", direction: "incoming", time: 0 });
  engine.endCall(15); // hovor 1: 15 s, nad limitem 10 s
  engine.startCall({ number: "+420700000002", direction: "incoming", time: 20 }); // mezera 5 s
  const warn = engine.openApp("testovaci-banka", 31); // hovor 2 trvá 11 s
  assert.equal(warn.warning, true);
  const result = engine.continueClicked(31);
  assert.equal(result.smsSentNow, true);
});

// --- Konec podezřelé situace (5.6 bod 5) ---

test("podezřelá situace končí 4 h (demo 5 min) po posledním neověřeném hovoru", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000000", direction: "incoming", time: 0 });
  engine.openApp("testovaci-banka", 12);
  engine.continueClicked(12);
  engine.openApp("testovaci-banka", 13);
  assert.equal(engine.getState().smsSent, true);
  engine.endCall(20);

  // uplyne víc než postCallContextWindowSec (demo 300 s) bez dalšího neověřeného hovoru
  engine.startCall({ number: "+420700333444", direction: "incoming", time: 321 });
  const freshWarning = engine.openApp("testovaci-banka", 332);
  assert.equal(freshWarning.warning, true);
  assert.equal(freshWarning.alarmPhase, false, "nová podezřelá situace, ne pokračování staré");
});

test("stejná podezřelá situace pokračuje, když nový neověřený hovor přijde do 4 h (demo 5 min)", () => {
  const engine = newEngine();
  engine.startCall({ number: "+420700000000", direction: "incoming", time: 0 });
  engine.openApp("testovaci-banka", 12);
  engine.continueClicked(12);
  engine.openApp("testovaci-banka", 13);
  assert.equal(engine.getState().smsSent, true);
  engine.endCall(20);

  // nový neověřený hovor do 300 s od konce předchozího - stejná situace
  engine.startCall({ number: "+420700333444", direction: "incoming", time: 100 });
  const result = engine.openApp("testovaci-banka", 111);
  assert.equal(result.warning, true);
  assert.equal(result.alarmPhase, false);
  assert.equal(result.smsSent, false, "poplach už v této situaci jednou odešel");
});
