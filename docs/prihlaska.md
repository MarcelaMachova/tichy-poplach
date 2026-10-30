# Přihláška — texty ke zkopírování do formuláře

Formulář: https://docs.google.com/forms/d/e/1FAIpQLSeO0dcEVbQ9V7cjIX1f6rlwaSSkS68aPaMBw8sxoFkdhG9Ytg/viewform

> Pole označená `[DOPLNIT]` čekají na údaj od Marcely.

**Jméno a příjmení kontaktní osoby:** `[DOPLNIT]`

**E-mail:** marcela.machova@codingbear.com

**Telefon:** `[DOPLNIT]`

**Projekt přihlašuji jako:** Firma

**Název týmu / organizace:** Coding Bear

**Název projektu:** Tichý poplach – ochrana proti falešnému bankéři/policistovi

(Jen pro formulář — projekt samotný, repozitář, UI simulátoru i video se dál
jmenují jen „Tichý poplach".)

**Popište projekt v pár větách:**
Tichý poplach je navržená Android aplikace proti telefonním podvodům
„falešný bankéř/policista". Nehlídá obsah hovoru, ale chování telefonu během
hovoru s neověřeným číslem — a v kritickém momentu zasáhne varováním na
displeji a SMS poplachem předem zvolenému blízkému. Pro výzvu jsme postavili
webový simulátor, který ukazuje otestovanou rozhodovací logiku na dvou
simulovaných telefonech.

**Co projekt dělá a komu pomáhá?**
Pomáhá lidem (cílově ženám kolem 45 let s Androidem a mobilním
bankovnictvím — typickému profilu oběti podle policie), kteří jsou v hovoru
s podvodníkem sami a pod tlakem mu věří. Nestaví na tom, že oběť podvod sama
pozná — spoléhá na to, že si toho všimne blízký, kterého aplikace upozorní.

**V jaké je projekt fázi?**
Koncept či nápad

(Formulář nabízí jen Koncept či nápad / Funkční MVP / Již fungující projekt —
žádný „Prototyp". Android aplikace, kterou projekt navrhuje, zatím neexistuje,
takže „Funkční MVP" by bylo zavádějící. Vysvětlení je v posledním poli.)

**Na kterou oblast výzvy se projekt zaměřuje?** (checkbox, lze zaškrtnout víc)
Prevence podvodů

**Jak konkrétně projekt tuto obavu snižuje nebo pomáhá lidem její dopady
zvládnout?**
Sleduje čtyři konkrétní signály v telefonu (bankovní aplikace v popředí,
notifikace a SMS od banky, instalace aplikace mimo Google Play) v kontextu
neověřeného hovoru a při dlouhých nebo navazujících hovorech zkracuje reakční
dobu. Místo spoléhání na to, že oběť podvod pozná, pošle SMS poplach
blízkému, který může zasáhnout zvenčí — zavolat, zajít za ní, poradit jí
zavěsit a ověřit si vše u banky na oficiálním čísle.

**Jakým způsobem projekt využívá AI?**
Samotné rozhodování v aplikaci je záměrně **pravidlové, ne AI** — kvůli
vysvětlitelnosti a tomu, že nepotřebuje cloud ani obsah hovoru. AI (Claude
Code) jsme použili při vývoji: k rešerši veřejných zdrojů o reálných
podvodných schématech, k převodu těchto schémat na testovací scénáře a
k napsání kódu, testů a laboratorního vyhodnocení.

**Jaké AI technologie, modely nebo nástroje používáte nebo plánujete
použít?**
Claude Code (Anthropic) jako vývojářský nástroj. V samotné aplikaci (za
běhu) žádný AI model neběží a neplánujeme ho tam zatím přidat — rozhodování
zůstává pravidlové kvůli vysvětlitelnosti a ochraně dat.

**Jak pracujete s možnými chybami, nepřesnostmi, bezpečností nebo ochranou
dat?**
Rozhodovací logika je pokrytá 18 jednotkovými testy a laboratorním testem na
26 scénářích (8 podvodných, 18 běžných) — výsledky včetně dvou planých
poplachů a jejich příčin jsou zveřejněné v `docs/vyhodnoceni.md`, nic jsme
nezametli pod koberec. Aplikace (podle návrhu) nikdy neposlouchá ani
neukládá obsah hovorů, notifikací ani SMS — pracuje jen s metadaty
(odesílatel, délka hovoru, čas). Žádná data neopouští telefon kromě jedné SMS
bez čísla volajícího a bez obsahu.

**Co chcete dělat s projektem po skončení výzvy?**
Přepsat logiku do Android aplikace (Kotlin), ověřit chování systémových
rozhraní v reálném telefonu, otestovat s reálnými uživatelkami v pilotu a
zkalibrovat časové lhůty podle skutečných dat. V delším horizontu spolupráce
s policií a bankami (viz README, sekce Fáze 2).

**Odkaz na projekt / demo / GitHub / web:**
`[DOPLNIT po zveřejnění — odkaz na GitHub Pages]` (odkaz na repozitář je
v README)

**Odkaz na video nebo jinou ukázku:**
https://youtu.be/6ca4lkQcjno

**Je ještě něco, co by porota měla o projektu vědět?**
Fázi projektu jsme označili jako „Koncept či nápad", protože cílová Android
aplikace zatím neexistuje — k dispozici je ale funkční webový simulátor
s otestovanou rozhodovací logikou (18 jednotkových testů, laboratorní test na
26 scénářích, viz odkaz na projekt a video výše). Lhůty v pravidlech (10
minut, 60 minut, 4 hodiny...) jsou výchozí odhady, protože veřejná statistika
o přesném načasování těchto podvodů neexistuje — zkalibrují se v pilotu.
Google od roku 2025 zavádí vlastní ochranu proti podvodům při sdílení
obrazovky na Androidu, ale v Česku z ní zatím funguje jen malá část a žádná
česká banka není mezi partnery (podrobně v README). Tichý poplach vznikl
nezávisle a liší se hlavně tím, že počítá s obětí, která varování nevěří,
a posílá poplach blízkému.

**Potvrzuji, že mám oprávnění tento projekt do soutěže přihlásit...**
Ano, potvrzuji

**Souhlasím s tím, že informace o projektu mohou být použity...**
Ano, souhlasím

**Souhlasím s pravidly AI výzvy pro Česko...**
Ano, souhlasím
