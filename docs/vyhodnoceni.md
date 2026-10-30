# Laboratorní vyhodnocení

Výsledky skriptu `scripts/evaluate-scenarios.js` nad scénáři v `data/scenarios.json`
(8 podvodných, 18 běžných — viz `data/legendy/zdroje.md` pro zdroje legend).
Skript běží s **normálními** (ne demo) časy z `rules.json`, protože měří skutečně
navržené chování, ne zkrácenou verzi pro video. Počítá s nejhorším případem:
uživatelka podvodníkovi věří a na každé varování klepne na Pokračovat.

Spuštění: `node scripts/evaluate-scenarios.js`

## Souhrn

| Metrika | Výsledek |
|---|---|
| Zachycené podvodné scénáře | 8 / 8 |
| Z toho odešel i SMS poplach blízkému | 3 / 8 |
| Planý poplach v běžné situaci | 2 / 18 |
| Z toho s odesláním SMS | 0 / 18 |

## Podvodné scénáře — v jakém kroku byly zachyceny

| Scénář | Zachyceno v kroku | Signál | SMS poplach |
|---|---|---|---|
| fraud-01 – napadený účet, kontrola v aplikaci | 2 (bankovní aplikace po 11 min) | bankovní aplikace | ano (2. signál: notifikace) |
| fraud-02 – instalace hned na začátku | 2 (instalace, 90 s) | instalace mimo Google Play | ne (jen 1 signál) |
| fraud-03 – podvržené „Moje banka“ | 2 (bankovní aplikace) | bankovní aplikace | ne (jen 1 signál) |
| fraud-04 – bankéř, pak policista | 4 (bankovní aplikace ve 2. hovoru) | bankovní aplikace + dlouhý hovor (5.5c) | ano (ihned po Pokračovat) |
| fraud-05 – hodinový hovor kvůli úvěru | 2 (bankovní aplikace) | bankovní aplikace + dlouhý hovor (5.5a) | ano (ihned po Pokračovat) |
| fraud-06 – SMS od banky zneužitá | 2 (SMS) | SMS od banky | ne (jen 1 signál) |
| fraud-07 – instalace po hovoru | 3 (instalace 15 min po hovoru) | instalace v okně 4 h | ne (jen 1 signál) |
| fraud-08 – odchozí na podvodné číslo | 2 (bankovní aplikace) | bankovní aplikace | ne (jen 1 signál) |

Všech 8 podvodných scénářů aplikace zachytila alespoň varováním. SMS poplach
odešel jen tam, kde scénář obsahoval druhý silný signál po Pokračovat, nebo kde
šlo o dlouhý hovor (5.5) — to odpovídá návrhu (5.6): jedno varování ještě
neznamená poplach blízkému.

## Plané poplachy — a proč

| Scénář | Proč planý poplach |
|---|---|
| benign-03 – skutečná banka volá a žádá ověření v aplikaci | Číslo banky je na seznamu institucí (5.3), takže hovor je vždy vyhodnocen jako neověřený — i když fakticky volá opravdová banka. Aplikace nepozná rozdíl mezi skutečnou bankou a podvodníkem, který její číslo podvrhl. |
| benign-04 – nový kamarád volá, nahlédnutí do bankovnictví | Kontakt uložený před méně než 24 h je podle 5.3 vždy neověřený. Legitimní, ale čerstvě uložený kontakt tak může vyvolat varování, pokud si uživatelka při hovoru otevře bankovnictví. |

Oba případy jsou **přímý důsledek navržených pravidel**, ne chyba v jejich
naprogramování — pravidla jsem kvůli tomu neupravovala. Jde o vědomý kompromis:
bez něj by aplikace nedokázala rozpoznat podvržené číslo banky v kontaktech
(5.3), což je přesně ten útok, který má zachytit (viz `fraud-03`). Snížení
citlivosti by snížilo počet planých poplachů, ale otevřelo by přesně tuto
mezeru útočníkům.

Hraniční test `benign-12` (hovor přesně 10 minut) potvrzuje, že práh „déle než
10 minut“ funguje ostře — přesně na hranici k varování nedojde.

## Co aplikace neumí a proč

- **Odlišit skutečnou banku od podvodníka, který její číslo podvrhl** (viz
  benign-03). Aplikace vidí jen číslo a chování v telefonu, ne obsah hovoru —
  to je záměr (obsah hovorů se záměrně neposlouchá), ale znamená to, že
  u podvrženého čísla instituce nejde rozdíl poznat vůbec.
- **Podvod, který neprojde přes telefon vůbec** — např. když podvodník
  přesvědčí oběť, aby šla osobně na pobočku banky, k bankomatu nebo
  bitcoinmatu bez jakékoli aplikace, notifikace nebo SMS na telefonu. Aplikace
  sleduje jen signály v telefonu (5.4), takže čistě fyzické jednání nezachytí
  — to je zmíněné jako limit i v README.
- **Podvod bez žádného silného signálu** — pokud hovor nikdy nevyvolá
  otevření bankovní aplikace, notifikaci, SMS ani instalaci (např. oběť už má
  peníze vybrané doma a jen je někomu předá), aplikace nemá co zachytit. Žádný
  z 26 scénářů tuhle variantu neobsahuje, protože by to nebyl scénář pro tuto
  aplikaci — je to ale limit, který patří do README.
- **Čerstvě uložený, ale legitimní kontakt** (benign-04) — pravidlo 24 h je
  nutně nepřesné u relativně nových, ale skutečných známých.

## Poznámka k poctivosti výsledků

Scénáře jsou simulované podle veřejných zdrojů (`data/legendy/zdroje.md`), ne
skutečná data obětí. Lhůty v `rules.json` jsou výchozí odhady, ne kalibrace z
dat o skutečném načasování podvodů — viz README.
