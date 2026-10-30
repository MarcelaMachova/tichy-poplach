# Jak AI pomohla při vývoji

Klíč k Claude API se v simulátoru **nepoužívá** — rozhodování v aplikaci je
záměrně pravidlové (vysvětlitelné, bez cloudu, viz `js/logic.js`). AI (Claude
Code) posloužila jako vývojářský nástroj během tvorby projektu. Tenhle
dokument popisuje jak a co se po cestě muselo opravit — poctivě, včetně chyb.

## Kde AI pomohla

1. **Převod policejních legend na scénáře.** AI vyhledala veřejné zdroje o
   podvodech „falešný bankéř/policista" (`data/legendy/zdroje.md`) a převedla
   popsané vzorce (napadený účet, bitcoinmat, spoofing čísla banky, schéma
   „nejdřív policista, pak bankéř") na 8 strojově přehratelných scénářů
   v `data/scenarios.json` plus 18 běžných situací pro kontrolu planých
   poplachů.
2. **Logika a testy z textu pravidel.** Pravidla ze zadání projektu (neověřený
   hovor, silné signály, dlouhý hovor) převedla AI do `js/logic.js` a k nim
   rovnou napsala 18 jednotkových testů
   (`node --test`) pokrývajících všechny tři varianty „dlouhého hovoru" a
   hranice typu „přesně 10 minut".
3. **Laboratorní vyhodnocovací skript**, který scénáře přehraje přes stejnou
   logiku a počítá zachycené podvody/planý poplach — bez ladění pravidel
   podle výsledku (viz níže).
4. **Rešerše k Googlově ochraně Androidu** — AI ověřila z veřejných zdrojů,
   které z nových ochran Google skutečně fungují v Česku (jen dvě ze čtyř,
   k říjnu 2026), než napsala srovnání do README.

## Co se muselo opravit

- **Chyba ve vypršení „podezřelé situace".** Při prvním návrhu logiky
  kontrola, jestli podezřelá situace už skončila (4 h bez dalšího
  neověřeného hovoru), běžela špatně ve chvíli, kdy mezitím začal úplně nový
  hovor — nový hovor „zamaskoval" to, že stará situace už dávno měla
  vypršet. Odhalil to unit test navržený přímo na tenhle okrajový případ;
  oprava přesunula kontrolu vypršení na začátek `startCall`, před přidání
  nového hovoru do historie.
- **Špatně spočítaný testovací scénář.** Jeden z testů na „součet neověřených
  hovorů za poslední 2 hodiny" měl čísla navržená tak, že platné okno 2 hodin
  by useklo část prvního hovoru — test by procházel ze špatného důvodu.
  Přepočítáno na čísla, kde časové okno nezasahuje do měřených hovorů.
- **`git init` nejde spustit v sandboxu Claude Code.** Sandbox zablokoval
  založení `.git` složky v kořeni projektu (založení repozitáře muselo
  provést ručně Marcela mimo Claude Code) — nejde o chybu v projektu, ale o
  bezpečnostní omezení vývojového prostředí.
- **Ruční odklikání simulátoru v prohlížeči AI neprovedla.** V sandboxu
  nebyl k dispozici nástroj na automatizaci prohlížeče a instalace dalších
  nástrojů nebyla podle zadání povolená. UI logiku AI ověřila ručním
  průchodem kódu podle scénáře ze zadání, ne kliknutím ve skutečném
  prohlížeči — skutečné proklikání udělala Marcela.

## Co AI záměrně neudělala

Podle zadání AI **neupravovala pravidla jen proto,
aby laboratorní test vyšel lépe**. Dva plané poplachy (podvržené číslo banky
v kontaktech, čerstvě uložený kontakt) jsou zapsané v `docs/vyhodnoceni.md`
jako vědomý kompromis vyplývající z pravidel, ne jako chyba k opravě.
