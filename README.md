# Tichý poplach

Webový simulátor chování Android aplikace proti telefonním podvodům typu
„falešný bankéř" a „falešný policista".

**Živý simulátor:** `[ZDE BUDE ODKAZ NA GITHUB PAGES PO ZVEŘEJNĚNÍ]`
**Video (1–2 min):** https://youtu.be/6ca4lkQcjno

## Pro koho a proč

Cílová skupina jsou ženy kolem 45 let s Androidem a mobilním bankovnictvím —
podle policie typický profil oběti podvodu „falešný bankéř/policista". Oběť je
v hovoru sama, pod tlakem, a podvodu věří. Peníze posílá sama: nainstaluje
aplikaci z odkazu, otevře bankovnictví, potvrdí platbu nebo úvěr.

Podle Českého barometru obav z AI 2026 se podvodů s AI obává **77,5 %** lidí,
ale jen **26,4 %** si věří, že by věrohodný AI obsah (foto, video, hlas)
poznali. Barometr neměří chování v hovoru ani zkušenost s podvodem — Tichý
poplach na tom proto nestaví. Nestaví na tom, že člověk podvod pozná.

## Co to je

**Toto je webový simulátor**, ne skutečná Android aplikace. Ukazuje chování
cílové aplikace na dvou simulovaných telefonech vedle sebe. **Rozhodovací
logika je skutečná a otestovaná** (`js/logic.js`, 18 automatických testů,
laboratorní test na 26 scénářích) — simulované jsou jen telefon a jeho
systémové události (hovory, notifikace, SMS, instalace).

Cílový produkt je aplikace pro Android, která **neposlouchá obsah hovorů**.
Hlídá, co člověk dělá s telefonem během hovoru s neověřeným číslem, a
v kritickém momentu zasáhne: varováním na displeji a SMS poplachem předem
zvolenému blízkému.

## Jak to funguje

1. **Neověřený hovor** — číslo není v kontaktech, nebo je sice uložené, ale
   je na seznamu čísel institucí (podvržené číslo banky, 158, ČNB), nebo bylo
   uloženo před méně než 24 h. Sám o sobě hovor nic nespustí.
2. **Silný signál** během neověřeného hovoru (nebo do 4 h po něm): instalace
   aplikace mimo Google Play (hned), nebo bankovní aplikace v popředí /
   notifikace od banky / SMS od banky (když hovor trvá déle než 10 minut,
   nebo jejich součet za poslední 2 h).
3. **Dlouhý hovor** (přes 60 minut, nebo součet přes 45 minut za 2 h, nebo dva
   navazující hovory z různých čísel — legenda „bankéř, pak policista")
   zkracuje cestu k poplachu, ne co se zobrazí.
4. **Zásah:** celoobrazovkové varování bez obviňování a bez otázek typu „Jste
   si jistá?". Po klepnutí na Pokračovat další silný signál (nebo rovnou u
   dlouhého hovoru) pošle **jednu** SMS blízkému — bez čísla volajícího, bez
   obsahu, bez názvů aplikací.

Podrobná pravidla jsou implementovaná v `js/logic.js`, data (seznamy a lhůty)
v `data/rules.json`.

## Lhůty jsou výchozí odhady

10 minut u bankovní aplikace/notifikace/SMS, 60 minut a 45 minut u dlouhého
hovoru, 4 hodiny u okna po hovoru — tyhle hodnoty **nevycházejí z dat**,
protože veřejná statistika o přesném načasování těchto podvodů neexistuje.
Jsou to rozumné výchozí odhady, které se zkalibrují v pilotu. V `rules.json`
jde vždy o jedno číslo.

## Vztah k ochraně Androidu od Googlu

Google od roku 2025 (Android 15/16) postupně zavádí ochranu proti podvodům
při sdílení obrazovky: když uživatel při hovoru s neuloženým číslem sdílí
obrazovku a otevře podporovanou bankovní aplikaci, Android zobrazí varování,
vynutí 30s pauzu a nabídne rychlé ukončení hovoru. Pilotovalo se ve Velké
Británii, nyní se rozjíždí v USA ve spolupráci s JPMorganChase a Cash App.
Android 15+ navíc skrývá citlivé údaje (hesla, čísla karet) při sdílení
obrazovky a blokuje tiché zapnutí přesměrování hovorů.

**V Česku** jsou k říjnu 2026 dostupné jen dvě z těchto ochran: skrývání
citlivých údajů při sdílení obrazovky (Android 15+, nezávisle na jazyce) a
blokování tichého přesměrování hovorů (od prosince, jen Pixel a vybrané
značky). Ochrana při otevření bankovní aplikace během hovoru i detekce
podvodných zpráv přes Gemini **v Česku zatím nefungují** — Gemini detekce
běží jen ve 48 zemích a devíti jazycích, čeština mezi nimi není, a žádná
česká banka zatím není mezi partnery (jen americké a brazilské banky a
Revolut). (Zdroje: [Google Security Blog – Android expands pilot for in-call
scam protection](https://blog.google/security/android-expands-pilot-in-call-scam-protection-financial-apps/),
[Android Central](https://www.androidcentral.com/apps-software/android-os/google-expands-in-call-spam-protection-to-the-us),
[GeekLife.cz – Google ohlásil pro Android nové ochrany proti podvodníkům](https://www.geeklife.cz/android-ochrana-podvody-sdileni-obrazovky/).)

Tichý poplach vznikl nezávisle na této funkci a staví na stejném principu
(sledovat chování telefonu během rizikového hovoru, ne obsah hovoru). Liší se
v tomto:
- **Poplach blízkému** — počítá s obětí, která varování nevěří a situaci
  nerozpozná sama; Googlova ochrana jen varuje uživatele samotného.
- **Funguje bez sdílení obrazovky** — spouští se i bez vzdáleného přístupu.
- **Nepotřebuje zapojení konkrétní banky** — pracuje s libovolnou bankou podle
  seznamu odesílatelů, ne přes partnerství jako Google.
- **Hlídá i dlouhé a navazující hovory**, podvržená čísla bank v kontaktech a
  notifikace/SMS od banky, ne jen okamžik otevření aplikace při sdílení
  obrazovky.

## Jak by to běželo na Androidu (návrh, neověřeno)

Následující mapování signálů na systémová rozhraní je **návrh pro fázi 2**,
ne ověřené chování — simulátor tyto signály jen simuluje.

| Signál | Android rozhraní / oprávnění |
|---|---|
| Stav hovoru (neověřený hovor) | `CallScreeningService` nebo `TelephonyManager` stav hovoru, `READ_PHONE_STATE` |
| Čas poslední změny kontaktu | `ContactsContract` (`CONTACT_LAST_UPDATED_TIMESTAMP`), `READ_CONTACTS` |
| Bankovní aplikace v popředí | `UsageStatsManager`, oprávnění `PACKAGE_USAGE_STATS` |
| Notifikace od banky (jen odesílatel) | `NotificationListenerService`, `BIND_NOTIFICATION_LISTENER_SERVICE` |
| SMS od banky (jen odesílatel) | `SmsManager` / `Telephony.Sms`, `RECEIVE_SMS` |
| Instalace balíčku a zdroj instalace | broadcast `PACKAGE_ADDED`, `PackageInstaller.SessionInfo.getInstallerPackageName()` |
| Běh na pozadí | foreground service, `FOREGROUND_SERVICE` |
| Odeslání SMS poplachu | `SmsManager.sendTextMessage`, `SEND_SMS` |
| Ukončení hovoru tlačítkem Ukončit hovor | `TelecomManager` — vyžaduje roli výchozí telefonní aplikace nebo systémové oprávnění; **potřebuje ověřit v prototypu**, accessibility service se nepoužije (zneužívají ji podvodníci) |

## Postaveno / Navrženo, nepostaveno

| Postaveno | Navrženo, nepostaveno |
|---|---|
| Webový simulátor: dva telefony, ovládací panel, simulované hodiny | **Aplikace pro Android (Kotlin)** — převod `logic.js` |
| `rules.json` + logika vyhodnocení (neověřený hovor, 4 silné signály, dlouhý hovor, limit 1 SMS/situace), 18 unit testů | Hovory přes WhatsApp a jiné VoIP |
| Demo režim se zkrácenými lhůtami | Signál NFC (podvod „Červí díra") |
| Události z panelu i klepnutím (hovory, Mobilní banka, notifikace, SMS, instalace) | Aplikace pro vzdálený přístup jako samostatný signál |
| Celoobrazovkové varování, Ukončit hovor, Zavolat blízkému, SMS poplach na telefon B | Kryptoburzy a nebankovní půjčky |
| Mobilní banka (napodobenina), Záznam, průvodce Nastavením | Aplikace-klíče bank |
| Laboratorní test na 26 scénářích (`docs/vyhodnoceni.md`) | Opakované hovory v několika dnech |
| Přehrávač scénářů + autopřehrávání demo scénáře | Poloha u bitcoinmatu |
| | Sdílení obrazovky jako signál |
| | Obrazovka „Co dělat teď" |
| | Odpočet před tlačítkem Pokračovat |
| | Uložení záznamu pro policii |
| | Tichý režim pro pilot |
| | PIN na Nastavení |

## Výsledky laboratorního testu

Shrnutí (plné znění v `docs/vyhodnoceni.md`):

- **8 / 8** podvodných scénářů aplikace zachytila alespoň varováním.
- U **3 / 8** z nich odešel i SMS poplach blízkému (ostatní skončily jen na
  jednom varování — to odpovídá návrhu, poplach vyžaduje druhý signál).
- **2 / 18** běžných situací vyvolalo planý poplach — oba vysvětlené a
  očekávané důsledky navržených pravidel (podvržené číslo banky v kontaktech,
  čerstvě uložený kontakt), ne chyba v kódu.

## Limity

- Ověřeno jen v simulátoru a na simulovaných scénářích, ne na skutečném
  telefonu ani u skutečných uživatelek.
- Chování skutečných Android rozhraní (tabulka výše) není ověřené.
- Jen Android — iOS neřeší.
- Nevidí hardwarový token, hovor na jiném zařízení ani akce mimo telefon
  (pobočka banky, bitcoinmat).
- Útočníci se přizpůsobí — jakmile se princip rozšíří, změní taktiku.
- Nerozpozná skutečnou banku od podvodníka, který její číslo podvrhl (viz
  `docs/vyhodnoceni.md`, planý poplach benign-03).

## Fáze 2

Aplikace pro Android, pilot s uživatelkami, iOS přes partnerskou banku,
spolupráce s policií (hlídka na místo u bitcoinmatu nebo kurýra) a s bankami
(zmrazení plateb), ověření hovoru „policie" přes eDoklady.

## Jak vyzkoušet

1. Otevřít živý simulátor (odkaz nahoře) nebo lokálně: `python3 -m http.server`
   v kořeni repozitáře a otevřít `index.html` v Chrome nebo Safari.
2. V panelu je zapnutý demo režim (zkrácené lhůty).
3. Ručně: vyvolat příchozí hovor z neznámého čísla, přijmout, po ~12 s
   otevřít Mobilní banku, Pokračovat, banku otevřít znovu → SMS na telefon
   B, Záznam na telefonu A.
4. Nebo vybrat scénář v „Přehrávači scénářů" a přehrát krok po kroku nebo
   automaticky. Scénář pro video (★ Doporučeno, "Bankéř": kontrola v
   aplikaci, pak instalace aplikace) je v nabídce první a předvybraný —
   je to ten, který by si měla přehrát porota. Zbytek nabídky je jen pár
   dalších podvodných scénářů — kompletní seznam všech 26 scénářů
   (8 podvodných + 18 běžných) a jejich vyhodnocení je v
   `docs/vyhodnoceni.md`.

## Spuštění testů

```
npm test                          # 18 unit testů logiky (node --test)
node scripts/evaluate-scenarios.js  # laboratorní vyhodnocení (viz docs/vyhodnoceni.md)
```
