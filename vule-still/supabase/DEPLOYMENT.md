# Primenjeni početni Supabase paket

## UI korak 3 — 25.11.2026.

Ovaj korak menja samo aplikacioni izbor i prikaz; **nema nove migracije niti produkcione primene**. Koristi postojeći ugovor za više usluga iz koraka 2. Testiranje je ograničeno na Vule-still-test (`xfbjgxtgvlyndonhlupm`), bez Auth/SMTP promena.

Pre/posle testova svih **51 zatečenih rezervacija** imaju isti fingerprint `350e0d3bf95ee14e4f6faf7299db1d6e`, uključujući dve ranije potvrđene. Pet novih sintetičkih dolazaka je otkazano, a njihova istorija/stavke/ključevi ostaju. Ukupno je 56 rezervacija, dve ranije potvrđene i **0 novih aktivnih UI3 termina**. Nova kontrolisana nedelja `2026-11-23` vraćena je u odsutno stanje tek posle provere praznog nacrta/objave, revizija 2/2, oba razmaka 60 i odsustva potvrđenih termina. Ranije nedelje i revizije su očuvane. Jedan zahtev za uslovno čišćenje je istekao bez izvršenja; ponovljen isti zahtev uspešno je završio.

Pri povratku koda zadržati sve ranije aditivne migracije i kombinovane rezervacije; ne brisati stavke ili svoditi dolaske na prvu uslugu. Korisničko prihvatanje, commit i push čekaju pregled. [Rezultati i granice provera](tests/RESULTS.md).

## Više usluga u jednom dolasku — 25.11.2026. (aktuelno)

Samo **Vule-still-test** (`xfbjgxtgvlyndonhlupm`). Lokalni izvor [20261125173402_multiple_service_reservations.sql](migrations/20261125173402_multiple_service_reservations.sql) primenjen je kao cloud verzija **`20261125174427`**, naziv `multiple_service_reservations`. Migracija dodaje `reservations.service_count`, tabelu `reservation_items`, kontrolisane RPC-ove i čitanje svih stavki. Postojeći pojedinačni RPC-ovi i sačuvani ključevi nisu prepisivani. Nasleđeni `service_id` ostaje ID prve sačuvane stavke, a `service_name` sažet naziv; ukupno trajanje je na roditelju. Čitanje ne zavisi od današnjih kataloških trajanja.

Pre primene provereni su stanje i fingerprint **47 rezervacija**, kao i rollback neuspešne migracije u izolovanoj bazi. Kopiranje širokog privatnog snimka odbijeno je automatskom proverom; takav fajl nije napravljen. Lista fizičkih backup-a nije potvrđena jer CLI nema pristupni token; nije vršen restore niti je testirana obnova celog cloud projekta. Umesto privatnog izvoza, primena je aditivna i atomska: bez izmene izvornih kolona/ključeva, sa testiranim rollback-om greške i kompatibilnošću prethodnog klijenta. Ovaj dokaz ne predstavlja fizički backup. Za operativni oporavak zadržati novu šemu i sve nastale stavke čak i pri vraćanju UI-ja.

Odmah posle primene: **47 rezervacija / 47 stavki**, bez neusaglašenog prenosa, RLS uključen. Fingerprint svih ranijih kolona (bez nove `service_count`) ostaje **`597ecb5f80918e4809deca9c5094e358`**. Posle stvarnih integracionih provera postoje četiri nove sintetičke otkazane rezervacije i njihove stavke/audit/ključevi; istorija se ne briše. Svih prethodnih 47 redova ima isti fingerprint. Nova kontrolisana nedelja `2026-11-23`, koja pre provere nije postojala, vraćena je u odsutno stanje tek posle provere tačnog sadržaja, revizija 2/2 i odsustva potvrđenih termina. Prvi zahtev za ovo čišćenje istekao je bez izvršenja; ponovljeni identičan zahtev uspeo je. Nijedna ranija nedelja nije menjana.

Novi privatni helper-i nisu dostupni `PUBLIC`/`anon`/`authenticated`; novi javni writer-i proveravaju sesiju, odnosno owner članstvo. Stavke su nepromenljive; deferred provera zahteva broj, redosled, naziv i zbir saglasne roditelju. RLS čitanje je ograničeno na vlasnika rezervacije, a vlasnički pregled ide kroz postojeći provereni RPC. Advisor nema nove RLS/no-policy nalaze; broj namenskih anon SECURITY DEFINER RPC-ova raste 2→3, authenticated 19→22. Novi WARN nalazi odnose se na eksplicitno dozvoljen anon kontekst dostupnosti i autentifikovane writer-e; provere identiteta i ACL su testirane. Postojeći anonymous-sign-in/password nalazi ostaju; nisu menjana Auth podešavanja. Performance advisor prijavljuje 9 informativnih nekorišćenih indeksa (pre 8), uključujući indeks nove tabele; ništa nije brisano. Objašnjenja: [definer RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Povlačenje premium ponude — 25.11.2026. (aktuelno)

Samo Vule-still-test (`xfbjgxtgvlyndonhlupm`). Lokalni izvor [20261125131831_withdraw_premium_services.sql](migrations/20261125131831_withdraw_premium_services.sql) primenjen je kao cloud verzija `20261125132151`, naziv `withdraw_premium_services`. Menja isključivo `is_active=false` na tri postojeća premium reda, izabrana kategorijom i postojećim slugovima. Pre primene pregledan je katalog i uspešno izvršena izolovana provera povlačenja, istorije i vraćanja istih usluga. Posle primene: četiri aktivne standardne usluge, tri neaktivne premium; ID-jevi, kategorije, nazivi i trajanja su očuvani. Nema promene šeme, RPC-ova, RLS ili Auth podešavanja.

Svih **47 rezervacija** ostalo je neizmenjeno: fingerprint svih kolona pre i posle `597ecb5f80918e4809deca9c5094e358`. Nije bilo cloud premium rezervacija za istorijski scenario; on je proveren u izolovanoj bazi sa potvrđenim i otkazanim primerima. Povratak ponude radi reaktiviranjem istih redova, bez brisanja/ponovnog kreiranja i bez promene UI koda; reaktivacija je proverena samo u izolovanom testu. Produkcija nije menjana. Detalji provera: [RESULTS.md](tests/RESULTS.md).

## Zasebna administracija i šablon — 3.11.2026. (najnovije)

Samo **Vule-still-test** (`xfbjgxtgvlyndonhlupm`, PostgreSQL 17.11.0.011). Prvo su pregledani stvarni objekti i istorija; četiri prethodne migracije nisu ponovljene. Dve nove migracije primenjene su jednom:

| Stvarna cloud verzija | Naziv | Lokalni izvor |
| --- | --- | --- |
| `20261103220140` | owner_schedule_template | [20261103215701_owner_schedule_template.sql](migrations/20261103215701_owner_schedule_template.sql) |
| `20261103221026` | owner_template_safe_replace | [20261103221012_owner_template_safe_replace.sql](migrations/20261103221012_owner_template_safe_replace.sql) |

Prva proširuje `schedule_templates` na nedelju i pauze, dodaje privatni singleton `schedule_template_settings` sa revizijom/razmakom, owner-only read/save RPC i pripremu novih nedelja iz koherentnog zaključanog snimka. Čuvanje šablona ne ažurira `schedule_weeks`. Druga čuva isto ponašanje, ali kvalifikuje zamenu šablona sa `WHERE weekday between 1 and 7`: stvarni hosted `safeupdate` odbio je nekvalifikovani DELETE sa `21000 / DELETE requires a WHERE clause`. Neuspešna transakcija nije promenila šablon. Izolovani PGlite nema taj provider dodatak; greška je otkrivena stvarnim RPC/Chrome testom i zatim ispravljena novom migracijom. Već primenjeni izvori nisu menjani.

RLS je uključen na novoj tabeli; nema direktnih browser dozvola. Novi RPC-ovi nisu izvršivi kao anon/PUBLIC, a authenticated pristup proverava važeću sesiju i posebno vlasničko članstvo. Promena šablona ima očekivanu reviziju i zajedničko zaključavanje sa pripremom. Generisani tipovi obnovljeni su iz stvarne test šeme. Auth/SMTP i produkcija nisu menjani.

Stvarni istovremeni template saves: HTTP **200/400**, drugi `TEMPLATE_CHANGED`, 201 ms, jedna revizija. Nova sintetička nedelja `2099-01-05` preuzela je nedeljnu smenu/pauzu i razmak 90 min; ponovna priprema nije prepisala nacrt. Prvobitni šablon vraćen je uz proveru revizije; isključivo taj novi nacrt uklonjen je SQL-om tek posle tačnog poređenja sadržaja, revizija 0/0 i potvrde da nema rezervacija. Nema preostalog testnog nacrta.

Konačno: **45 rezervacija, 1 potvrđena**. Svih **29/29 prethodnih redova** ima isti fingerprint kao pre testova; postojeća potvrđena rezervacija je očuvana. Preostalih 16 novih rezervacija je testna otkazana istorija. Nema preklopljenih potvrđenih parova. Jedina konkretna nedelja ostaje `2026-11-02`, istog nacrta/objavljenog sadržaja i oba razmaka 60; revizije su **74/42**. Šablon je isti kao pre testova, revizija **12**, razmak 60. Istorija/audit/revizije se ne brišu.

Security advisor posle izmena: 7 RPC-only tabela sa RLS/no-policy INFO, 2 namenska javna i 19 authenticated SECURITY DEFINER upozorenja, kao i ranije isključena leaked-password zaštita. To nisu nula nalaza. Pregledani su ACL i provere identiteta; privatne tabele ostaju zaključane, owner RPC-ovi proveravaju članstvo. Objašnjenja: [RPC-only RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authenticated definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [završna password zaštita](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Rezultati: [RESULTS.md](tests/RESULTS.md). Aditivne migracije nemaju automatski down. Za rollback interfejsa zadržati kompatibilnu šemu i sačuvane nedelje/rezervacije; ne brisati podatke radi povratka koda. Stariji zapis ispod je istorijski.

Performance advisor nakon izmena vraća 4 informativna nekorišćena indeksa; indeksi nisu brisani. Nema novih performance upozorenja. [Objašnjenje unused-index nalaza](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Aktuelno stanje test projekta — 3. 11. 2026.

Tekući razvoj je isključivo na **Vule-still-test** (`xfbjgxtgvlyndonhlupm`), potvrđeno imenom/ref-om kroz konektor. PostgreSQL 17.11, projekat aktivan. Četiri migracije ispod su već primenjene, a njihova istorija i stvarna šema ponovo su pregledane. **Ne primenjivati ih ponovo. U ovom nastavku nije bilo DDL/migracija ili Auth/SMTP promena.**

| Stvarna cloud verzija | Naziv | Lokalni izvor |
| --- | --- | --- |
| `20261103173150` | booking_transactions | [20261103120000_booking_transactions.sql](migrations/20261103120000_booking_transactions.sql) |
| `20261103173922` | customer_notifications | [20261103180000_customer_notifications.sql](migrations/20261103180000_customer_notifications.sql) |
| `20261103174346` | reviewed_confirmation | [20261103190000_reviewed_confirmation.sql](migrations/20261103190000_reviewed_confirmation.sql) |
| `20261103175334` | owner_reservations | [20261103200000_owner_reservations.sql](migrations/20261103200000_owner_reservations.sql) |

Razlika između planiranih lokalnih naziva i stvarnih MCP verzija je namerna. Starije foundation/activity/schedule/availability migracije ranije su primenjene SQL Editor-om i nisu u ovoj CLI istoriji. Nepotpuna istorija nije dozvola za replay; pregledati objekte pre bilo kakve buduće migracije. [Stari preflight](scripts/phase7_preflight.sql) je pregled pre prve primene, a ne trenutna inventura.

Potvrđeni su customer/owner RPC-ovi, kolone vlasništva/gosta/snimka/verzije, RLS na sve četiri booking tabele, GiST `reservations_no_overlap` i zabrana anonimnog izvršavanja owner RPC-ova. Authenticated izvršavanje zahteva proveru sesije i vlasničkog članstva unutar funkcija; običan korisnik dobija odbijanje, uključujući HTTP 403 na vlasničkom API-ju.

Posle završnog Chrome paketa: **27 rezervacija, sve otkazane**, 0 potvrđenih preklapanja, 0 rezervacija bez confirmation audita i 0 povezanih rezervacija bez confirmation obaveštenja. Nedelja `2026-11-02`: nacrt/objavljeni sadržaj i razmak 60 min vraćeni tačno na početni sadržaj; konačne revizije **50/26**. Sačuvana je postojeća pauza 3. novembra u Zrenjaninu 10:40–11:00. Otkazana istorija, događaji, revizije i sintetički nalozi ostaju; ništa se ne briše radi testa.

Security/performance advisori pregledani su bez promena šeme: privatne RPC-only tabele namerno nemaju direktne RLS politike; javni availability/schedule i autentifikovani definer RPC-ovi imaju namenske provere. Leaked-password zaštita je isključena u testu i ostaje stavka završnog Auth bloka ([Supabase uputstvo](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Informativno nekorišćeni indeksi nisu brisani ([objašnjenje](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)). Ovo nije tvrdnja da advisori imaju nula nalaza.

Rezultati i granice: [RESULTS.md](tests/RESULTS.md), [najnovija predaja](../../PHASE_PLAN.md). Buduća produkcija `usokysukvtgtvrtxnjai` nije korišćena niti menjana. Dalji tekst je istorijska evidencija početnog produkcionog paketa.

Datum: 01.11.2026.

Projekat: `usokysukvtgtvrtxnjai` — `https://usokysukvtgtvrtxnjai.supabase.co`.

Pre primene je potvrđeno: nema poslovnih tabela, migracija ni Auth korisnika. PostgreSQL verzija projekta je 17.11.

## Migracije

| Verzija | Naziv | Rezultat |
| --- | --- | --- |
| `20261101215730` | `foundation` | Uspešno primenjena |
| `20261101215737` | `reference_data` | Uspešno primenjena |
| `20261101220017` | `consolidate_read_policies` | Uspešno primenjena |

Lokalni nazivi migracija usklađeni su sa verzijama koje je evidentirao Supabase. Prve dve datoteke su isti SQL prethodno pripremljen pod nazivima `20261031000100_foundation.sql` i `20261031000200_reference_data.sql`. Treća migracija objedinjuje pravila čitanja, uz očuvanje istog pristupa za posetioca, korisnika i admina.

## Potvrđeno stanje

| Tabela | Broj zapisa | RLS |
| --- | --- | --- |
| `profiles` | 0 | Uključen |
| `admin_memberships` | 0 | Uključen |
| `locations` | 2 | Uključen |
| `staff` | 1 | Uključen |
| `services` | 7 | Uključen |

Auth korisnika: 0. Nisu kreirani lažni korisnici ili rezervacije. Administratorsko ovlašćenje čeka prvu stvarnu verifikaciju dogovorenog mejla, pa `bootstrap_admin.sql` nije izvršen.

Adrese, javni telefoni i lično ime frizera ostali su prazni. Inicijalizovana je samo potvrđena ponuda i dva grada.

## Izvršene provere

- **45 SQL provera prolazi** nad sve tri migracije u izolovanom PGlite/PostgreSQL 18.6 okruženju.
- Stvarni Data API sa publishable ključem vraća 2 aktivne lokacije i 7 usluga.
- Anonimni API zahtevi za `profiles`, `admin_memberships` i `staff` odbijeni su greškom `42501`.
- `app_private` nije izložen kroz Data API.
- Na projektu je potvrđeno da običan korisnik nema pravo izmene `booking_blocked`, a anonimni korisnik nema pravo izmene profila niti poziva internog helper-a.
- Supabase security advisor: **0 nalaza**.
- Supabase performance advisor: **0 nalaza**. Tri prvobitna upozorenja za višestruka pravila čitanja uklonjena su trećom migracijom.
- `npm run build`: uspešan, uključujući TypeScript i Proxy.
- Lokalni razvojni server je pokrenut na `http://localhost:3000`; provereni su HTTP 200, naslov `Vule Still` i prazan stderr log.
- `npm audit --omit=dev`: **0 prijavljenih ranjivosti** u produkcionim zavisnostima.

Komanda `npm run check:supabase` koristi publishable ključ i obavlja samo čitanje. Ne kreira naloge, ne šalje mejlove i ne upisuje test podatke u cloud.

## Aplikacija

Dodati su tipovi generisani iz stvarne baze, browser/server klijenti i Proxy za osvežavanje Supabase sesije. Konfiguracija je u ignorisanom `.env.local`; `.env.example` sadrži samo zamenske vrednosti. Administratorski/secret ključ nije dodat u aplikaciju.

Trenutni lokalni klijent čita katalog iz ovog cloud projekta. Sintetički podaci i SQL negativne provere ostaju isključivo u memorijskom testu. Pre punih testova prijave, korisničkih mutacija i rezervacija treba obezbediti odvojeno razvojno Auth/API okruženje prema planu.

## Preostalo i ograničenja

Prijava/registracija kodom, profil u interfejsu, globalna neaktivnost od 30 dana, raspored i rezervacije još nisu implementirani. Proxy osvežava/verifikuje token; sam po sebi ne sprovodi administratorsku autorizaciju ili globalni rok neaktivnosti. Prava trenutno čuva baza kroz RLS.

Stvarni OTP, SMTP, dolazak do admin uloge posle verifikacije, autentifikovani REST zahtevi i ponašanje na dva uređaja nisu testirani ovim korakom. Domen i servis za javno slanje kodova ostaju otvorene stavke.

Pun `npm audit` prijavljuje **16 moderate nalaza u razvojnom ESLint/minimatch lancu**, vezanih za [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Provera bez razvojnih zavisnosti nema nalaze. Automatski predlog zahteva nekompatibilne promene lint paketa, pa nije primenjen `--force`; razvojni alat zahteva zasebnu kompatibilnu nadogradnju. Supabase runtime biblioteke nisu prijavljene u tom nalazu.
