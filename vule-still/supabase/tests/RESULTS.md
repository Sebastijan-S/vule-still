# Rezultat početnih SQL provera

## UI korak 3 — 25. novembar 2026. (aktuelno)

**Spremno za korisnički pregled.** Samo Vule-still-test (`xfbjgxtgvlyndonhlupm`); bez novih migracija, izmene Auth podešavanja, produkcije, commit-a ili push-a.

- **152 SQL provere PASS**, ceo postojeći izolovani PGlite paket. **30 lokalnih testova PASS**: auth 6, dostupnost 14, booking 10 (uključujući 5 novih navigacionih provera). **Lint, TypeScript, `git diff --check` i konačni `build:test` PASS.** Next.js je više pokušaja zaustavio poznatim sigurnosnim podsetnikom posle kompilacije/generisanja stranica; završno ponavljanje vraća 0 uz zadržano upozorenje. Zavisnosti nisu menjane; sigurnosna nadogradnja ostaje zaseban posao.
- **19/19 ciljanih Google Chrome testova PASS**, 1 worker, 0 retries, oko 1,1 min na razvojnom serveru `127.0.0.1:3100`. Paket: novi `booking-flow.spec.ts`, 11 scenarija iz `booking-selection.spec.ts`, šest prilagođenih premium regresija i postojeći test kataloga. Posle završne male korekcije čitanja nacrta dodatno su ponovljena **3/3** direktna/stara povratna linka (ne predstavljaju tri dodatna različita scenarija). Ceo stariji browser paket sa istorijskim Zrenjanin/Auth očekivanjima nije označen kao ponovljen.
- Na **360/390/1280 px** provereni su opšti ulaz bez koraka jedine lokacije, kućice, zabrana praznog izbora, zbir 20+10=30, uklanjanje poslednje stavke, promena posle izabranog vremena, odbacivanje prekratkog početka i zadržavanje i dalje odgovarajućeg početka, prethodni korak i refresh pregleda. Direktan `?usluga=brada` otvara vreme; dodavanje druge stavke opstaje pri refresh-u istog linka. Stari scalar nacrt radi i kroz stari link sa `lokacija`/`usluga` parametrima.
- Povučena stavka u sačuvanom kombinovanom izboru ostavlja ostale usluge, datum/lokaciju i drugu osobu; uklanja početak i zahteva eksplicitan pregled, uključujući novi refresh. Pending testovi za **scalar/array × potvrđen/odbijen** šalju isti originalni payload, redosled i ključ, bez prethodne provere dostupnosti, i kada sačuvana stavka/lokacija više nisu u aktivnoj ponudi. To su kontrolisani HTTP odgovori; stvarna SQL idempotentnost ima zasebne regresije.
- **Stvarni ceo tok:** anonimni ulaz → dve usluge → datum/vreme → prijava kontaktom → refresh profila → dopuna profila → povratak na isti pregled → druga osoba → refresh → potvrda. Browser odbacuje odgovor tek pošto server uspešno upiše dolazak; posle refresh-a isti sačuvani payload/ključ vraćaju **jednu rezervaciju, dve stavke, 30 min i jedno obaveštenje**. Izbor, pregled, potvrda, „Moji termini“ i vlasnička kartica saglasno prikazuju **16:00–16:30**. Vlasnički ručni unos dve usluge bez telefona daje **17:00–17:30**; pomeranje celog dolaska na **17:30–18:00** čuva obe stavke, bez mogućnosti izmene sastava u formi. Oba termina redovno su otkazana. Vlasnički formular proveravan je na 390/1280 px.
- Povratak druge dostupne lokacije proveren je **na izolovanim podacima zajedničke navigacione funkcije**: vraćaju se sva četiri koraka i obavezan izbor, rade direktna i sačuvana druga lokacija, ne vraća se povučena lokacija. Nije aktiviran Zrenjanin u cloud bazi. Pokušaj browser simulacije menjanjem HTML/RSC odgovora nije hidriran zbog Chrome ograničenja lokalne mreže; automatska provera odbila je dodatnu browser dozvolu. Taj pokušaj nije prolaz; dozvole nisu menjane i nema tvrdnje da je testiran ceo browser tok druge lokacije.
- **Integrisani browser:** ručno pregledani desktop i mobilni izbor 390 px, vidljive kućice i oznake, zbir 30 min i prelazak na vreme. Chrome snimci su u ignorisanom `test-results/ui3-*.png` (izbor, vreme na tri širine, pregled/potvrda i vlasnički formular).
- **Čišćenje i readback:** početnih **51 rezervacija** ima identičan fingerprint pre/posle (`350e0d3bf95ee14e4f6faf7299db1d6e`). Ostaju dve ranije potvrđene rezervacije; **0 novih aktivnih UI3 termina**. Ukupno **56** rezervacija, od toga pet novih sintetičkih **otkazanih** (jedna iz dijagnostičkog prolaza i po dve iz dva završena prolaza). Stavke, ključevi, audit i obaveštenja ostaju kao istorija. Tri sintetičke gostujuće sesije/profila ostaju samo u testu. Nova kontrolisana nedelja `2026-11-23` korišćena je samo uz prethodnu proveru da ne postoji; svaki put je ispražnjena redovnim RPC-ovima, pa uslovno uklonjena tek uz tačan snimak `[]/[]`, revizije 2/2, razmake 60/60 i odsustvo aktivnih termina. Završno ponovo ne postoji. Ranije nedelje imaju iste revizije **76/44** (`2026-11-02`) i **0/1** (`2026-11-16`). Nije brisana istorija ili prepisivan tuđ raspored.

Ponovljive komande iz `vule-still/`:

```powershell
npm.cmd --prefix supabase/tests test
npm.cmd run test:auth
npm.cmd run test:availability
npm.cmd run test:booking
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build:test
npm.cmd run test:browser -- booking-selection.spec.ts booking-flow.spec.ts premium-withdrawal.spec.ts guest-contact.spec.ts -g "selection|direct legacy|withdrawn|pending|catalogue|legacy scalar|controlled full"
```

Stvarni flow test namerno odbija postojeću buduću nedelju umesto da prepiše raspored; čišćenje nove prazne nedelje zahteva uslovnu proveru iznad. Lokalni razvojni server ostaje **uključen na http://127.0.0.1:3100**, administracija `/administrator`.

## UI korak 2 — 25. novembar 2026. (aktuelno)

- **152 SQL provere PASS** u celom paketu: ranijih 137 + 15 novih grupa `multiple-services.test.mjs`. Izolovani PGlite sa Auth fixtures. Provereni su rollback neuspešne migracije, stari ključevi nastali pre migracije, tačan prenos potvrđene i otkazane premium istorije iz sačuvanih vrednosti, 20+10 u neprekinutih 30 minuta, odbijanje kraćih/prekinutih perioda i pauza, prazne/duple/neaktivne stavke, promena pregleda, pravila razmaka između lokacija, rollback neuspešnog obaveštenja sa svim stavkama i ključem, istorija, ceo pomereni/otkazani interval, scalar i jednočlani novi format, RLS/ACL i nepromenljivost/odložena provera integriteta.
- **25 lokalnih testova PASS**: auth 6, dostupnost 14, booking 5. **Lint i TypeScript PASS. `build:test` PASS.** Dva pokušaja builda zaustavila su se na postojećem Next.js sigurnosnom podsetniku posle uspešnog kompajliranja; završni pokušaj vratio je 0 i zadržao upozorenje. Zavisnosti nisu menjane u ovom koraku.
- **8/8 ciljanih Google Chrome testova PASS**, kanal `chrome`: šest regresija povlačenja premium ponude, postojeći katalog i novi kompletan integracioni test. Novi test preko lokalnih autentifikovanih API ruta istovremeno šalje kombinaciju od 30 minuta u 16:00 i jednočlani izbor od 20 minuta u 16:20: odgovori **200/409**, jedan dolazak. Dva istovremena ponavljanja istog novog ključa: **200/200, isti ID/odgovor, jedno obaveštenje**. Provereni su zbir/kraj i sve stavke u javnoj dostupnosti, klijentskoj kartici (390/1280 px), vlasničkoj kartici i formi pomeranja; cela kombinacija pomerena je 16:00→17:00 uz kraj 17:30 i iste stavke u obaveštenju. Prolaze i novi vlasnički API, odbijanje duplikata i stvarna potvrda jedne usluge kroz postojeći UI. Ceo stariji browser paket sa zastarelim Zrenjanin scenarijima nije označen kao ponovljen.
- Posle stvarnih testova **4 sintetičke rezervacije su otkazane**, njihove stavke/ključevi/audit/obaveštenja ostaju kao istorija. Nova kontrolisana nedelja `2026-11-23` vraćena je u prethodno odsutno stanje uz uslovno čišćenje praznog sadržaja/revizija 2/2 i proveru da nema aktivnih termina. Nijedna ranija nedelja nije menjana. Svih **47 ranijih rezervacija** ima isti fingerprint originalnih kolona pre migracije i posle svih testova. Nema aktivnih testnih dolazaka.
- Cloud migracija **`20261125174427`** odgovara lokalnoj `20261125173402_multiple_service_reservations.sql`. Generisani tipovi obnovljeni su sa test projekta. Nova tabela ima RLS i eksplicitne ACL provere. Granice backupa i pregled namenskih definer upozorenja evidentirani su u [DEPLOYMENT.md](../DEPLOYMENT.md); ne tvrdi se da je testiran fizički restore. Produkcija i Auth podešavanja nisu menjani.

Lokalni server ostaje na **http://127.0.0.1:3100**. Forme i dalje biraju jednu uslugu; sledeći korak je višestruki izbor i skraćen tok iz koraka 3. Rezultati su zabeleženi pre Git checkpointa ovog koraka.

## UI korak 1 — 25. novembar 2026. (aktuelno)

- **137 SQL provera PASS:** ceo paket, uključujući sedam novih grupa u `premium-withdrawal.test.mjs`. Izolovani PGlite i zamenske Auth sesije; nije provera stvarne konkurentnosti. Nove grupe pokrivaju četiri aktivne usluge za sve uloge, odbijanje svake povučene usluge kroz dostupnost, obe javne potvrde i vlasnički RPC, nepromenjene istorijske snimke, idempotentno ponavljanje postojećih ključeva, prikaz istorije, pomeranje/otkazivanje i vraćanje istih sedam redova u ponudu. Stari test preklapanja eksplicitno reaktivira premium stavke samo u svom izolovanom scenariju.
- **24 lokalna testa PASS:** auth 6, dostupnost 14, rezervacije 4. **Lint i `build:test` PASS.** Next.js pri pokretanju i buildu prijavljuje postojeće sigurnosno upozorenje za instaliranu verziju; zavisnosti nisu menjane u ovom koraku. Prvo pokretanje/build zaustavljeni su podsetnikom, ponovljene komande završile su uspešno.
- **7/7 ciljanih Google Chrome testova PASS:** šest novih testova i prilagođeni postojeći test kataloga. Provereni su svi stari premium linkovi na 390/1280 px, četiri opcije bez prazne grupe, vraćanje nacrta sa sačuvanim datumom/lokacijom i očišćenim početkom, četiri usluge u ručnom unosu i stvarni HTTP 409 za sve tri premium stavke na javnom i vlasničkom API-ju. Testovi odbijenih zahteva ne stvaraju rezervacije. Dva pending scenarija proveravaju tačan sačuvan payload i završetak/oporavak simuliranim HTTP odgovorima, bez stvarne potvrde. Stvarna SQL idempotentnost proverena je odvojeno u izolovanoj bazi. Ceo stariji browser paket nije ponavljan.
- Read-only Data API provera **PASS:** četiri javno vidljive usluge, privatne tabele i interna šema i dalje nedostupne anonimnom korisniku. Svih 47 cloud rezervacija ima isti fingerprint pre i posle migracije; videti [zapisnik primene](../DEPLOYMENT.md). Produkcija nije menjana, commit/push nisu izvršeni.

Razvojni server ostavljen je na **http://127.0.0.1:3100** za korisničku proveru. Izbor više usluga nije uključen; slede koraci 2 i 3 UI plana.

## Zaseban administratorski interfejs — 3. novembar 2026. (najnovije)

Ovaj zapis ima prednost nad starijim statusima ispod. Faza 10 je tokom izrade zasebnog interfejsa vođena kao **In progress**; nakon provera je **Ready for review**, bez korisničkog prihvatanja. Samo Vule-still-test (`xfbjgxtgvlyndonhlupm`). Ranijih **115 SQL / 23 lokalne / 12 Chrome** i prethodnih 7 stvarnih booking integracionih grupa ostaju istorijski dokazi; nisu obrisani ili preimenovani u nove rezultate.

| Završna provera ovog nastavka | Rezultat i granica |
| --- | --- |
| `npm.cmd run build:test` | **PASS**, gotov testni build sa odvojenim public/owner layout-ima i rutama `/administrator` i `/administrator/sablon`. |
| `npm.cmd run lint` | **PASS**, bez grešaka/upozorenja. |
| `npm.cmd --prefix supabase/tests test` | **122 PASS** = prethodnih 115 + 7 template grupa. PGlite, izolovane Auth/session fixtures; nije prava konkurentnost. |
| `npm.cmd run test:auth`, `test:availability`, `test:booking` | **23 PASS** (5+14+4). |
| `node --env-file=.env.test.local node_modules/@playwright/test/cli.js test --reporter=list,json` | **15/15 PASS, oko 1,4 min**, instalirani Google Chrome (`channel: chrome`), 1 worker, 0 retries, gotov build na `127.0.0.1:3100`. `PLAYWRIGHT_JSON_OUTPUT_NAME` je bio u Temp direktorijumu; konačan izveštaj kopiran u ignorisani `test-results/phase10-final-results.json`. |
| `node --env-file=.env.test.local scripts/check-template-live.mjs` | **3 stvarne grupe PASS:** paralelna revizija; novi budući nacrt sa nedeljom/pauzom/razmakom i bez prepisivanja pri ponovnoj pripremi; vraćanje prvobitnog šablona. Samo sintetički testni owner, bez slanja mejla. |
| `node --env-file=.env.test.local scripts/check-supabase.mjs`, `scripts/check-auth-no-email.mjs` | **PASS**, ispravan testni projekat, 2 lokacije/7 usluga, privatnost, postojeći no-email Auth; 0 upisa/novih naloga/mejlova u ovim read-only proverama. |
| `git -c core.safecrlf=false diff --check` | **PASS**. |

**Novi Chrome dokazi:** direktan zaseban ulaz i povratak vlasnika bez uslova kompletnog klijentskog profila; običan korisnik odbijen na ulazu/rutama, HTTP 403 sa owner read/write API-ja i SQL 42501 sa novih template RPC-ova. Nema javnog header/footer-a ili javnih navigacionih sekcija u owner ekranima; javni sajt nema administratorski link. Prijava, rezervacije, oba kalendara i šablon provereni su na **360/390/1280 px**, bez preliva stranice; snimci su pregledani vizuelno. Odjava vraća zaseban ulaz i ostaje odjavljena posle osvežavanja.

Povezana klijentska rezervacija pomerena je sa **4. na 5. novembar** kroz stvarni UI. Druga rezervacija zauzela je odabrani novi slot nakon učitavanja dostupnosti: pomeranje je odbijeno, prethodno vreme/verzija/obaveštenja ostali su isti. Posle izbora drugog slobodnog vremena uspeva jedna izmena sa sačuvanom uslugom/trajanjem. Prolaze sedmodnevni prikaz, filteri, odustajanje od potvrde otkazivanja i potvrđeno redovno otkazivanje. Klijent posle nove prijave/osvežavanja vidi trajna 3 obaveštenja: potvrda, promena, otkazivanje. Dana 3.11. u vreme provere više nema dozvoljenih današnjih radnih slotova; provereno je pomeranje između dva naredna datuma kroz isti opšti izbor datuma.

Postojeći owner test ponovo proverava gosta samo sa imenom, opcioni telefon, izmenu, redovno otkazivanje i **odbijenu konfliktnu objavu** sa nepromenjenom potvrđenom rezervacijom i objavljenim snimkom. Gost nema lažni nalog ili dostavu obaveštenja. Postojeći customer/retry/privatnost/profile/activity/focus scenariji prolaze u istom konačnom paketu.

Šablon je kroz UI sačuvan/osvežen, a postojeća nedelja ostala je potpuno ista. Konkretna nedelja 8.11. otvorena je 10–12 sa pauzom 11–11:20, dajući 5 početaka od 20 min bez termina u pauzi; posle uklanjanja i objave razlog je `closed`. Prvobitni raspored i šablon vraćeni su sa proverom revizija. Stvarni paralelni saves šablona: **200/400, TEMPLATE_CHANGED, 201 ms**, jedna revizija. Nova testna nedelja `2099-01-05` preuzela je šablon/90-minutni razmak; kasnije je samo taj nacrt uklonjen uslovnim SQL-om posle tačnog poređenja snimka i odsustva rezervacija. Skripta namerno evidentira snimak za tu proveru u ignorisanom `.env.phase10-template-state.local`; nije samostalni produkcioni alat za čišćenje.

**Otkriveno/ispravljeno:** hosted `safeupdate` je odbio nekvalifikovani DELETE u novom template RPC-u; neuspeh je bio atomski. Dodata je korektivna migracija sa ograničenim WHERE uslovom, pa stvarni RPC i sve provere prolaze. TypeScript konfiguracija više ne uključuje zastarele generisane validatore iz starih faznih build direktorijuma, koji posle route-group pomeranja upućuju na stare fizičke putanje. Nove browser provere koriste combobox selektore za „Prikaz“/status, a profilni povratni parametar ograničen je na formular u main-u zbog dodatnog logout polja. Početni nezavršeni testni pokušaji nisu označeni kao prolazi. Završni paket nema retry ili preskočene testove.

**Završni readback:** svih **29/29 redova rezervacija od pre testova** imaju identičan fingerprint; među njima je postojeća potvrđena rezervacija. Sada ima **45 ukupno / 1 potvrđena**; **0 novih potvrđenih** iz ovog nastavka i 0 preklopljenih potvrđenih parova. Originalni nacrt/objavljeni sadržaj i oba razmaka identični su pre-test snimku. Nedelja `2026-11-02`: revizije **74/42**; šablon isti, revizija **12**, razmak 60. Postojeća pauza 3.11. 10:40–11:00 je očuvana. Četiri nova sintetička signup naloga iz dva zajednička paketa, otkazana booking istorija, audit i revizije ostaju samo u testu. Nije brisana tuđa istorija niti vraćana revizija unazad.

Četiri ranije migracije nisu ponavljane. Dve nove primene i ograničenja rollback-a su u [DEPLOYMENT.md](../DEPLOYMENT.md). Security advisor i ACL provereni; poznate namenske definer/RPC-only i test password napomene ostaju dokumentovane, bez tvrdnje da je produkcija proverena. No Auth/SMTP promena, produkcije, commit-a, push-a ili javne objave. [Vlasničko uputstvo](../../../docs/ADMINISTRACIJA.md), [predaja](../../../PHASE_PLAN.md).

## Završetak customer/owner provera — 3. novembar 2026.

Aktuelni zbir ima prednost nad istorijskim izveštajima ispod. Isključivo Vule-still-test (`xfbjgxtgvlyndonhlupm`); bez produkcije, novih migracija, Auth izmena, mejlova, objave, commit-a ili push-a.

| Provera u ovom nastavku | Rezultat / granica dokaza |
| --- | --- |
| `npm.cmd --prefix supabase/tests test` | **115 PASS** = 45 temelj + 17 sesije + 12 raspored + 6 dostupnost + 26 booking + 9 owner. Izolovani PGlite, sintetički Auth/session fixtures, sekvencijalne transakcije. |
| `npm.cmd run test:auth`, `test:availability`, `test:booking` | **23 PASS** = 5 + 14 + 4 lokalne provere. Vremenske granice/DST i ugovori; nisu zamena za pravi Auth/konkurentnost. |
| `npm.cmd run build:test` | **PASS**, novi gotov build na testnom okruženju, sve customer/owner rute. Poruka Next-a da učitava `.env.local` ne menja process promenljive iz kontrolisanog test runner-a. |
| `npm.cmd run lint` | **PASS**. |
| `git -c core.safecrlf=false diff --check` | **PASS**, bez whitespace grešaka. |
| Završni `npm.cmd run test:browser -- --reporter=list,json --output=test-results/final-chrome` | **12/12 PASS, 59.2 s**, instalirani Google Chrome (`channel: chrome`), 1 worker, 0 retry, novi gotov build na `127.0.0.1:3100`. JSON kroz `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/final-chrome-results.json`; ignorisani lokalni dokaz. |

**Pronađen uzrok zastoja:** prvi vlasnički pokušaj istekao je posle 120 s. Kraći rok i dijagnostika su pokazali `locator.selectOption` na tačnom label selektoru „Filter lokacije“. Ručni unos, izmena i redovno otkazivanje već su prošli; kvar administracije time nije potvrđen. Selektor je zamenjen sa `getByRole('combobox', { name: 'Filter lokacije', exact: true })`, a akcije imaju rok 15 s. Samostalni vlasnički test zatim prolazi za 17.0 s, a u konačnom paketu za 17.1 s. Aplikaciona poslovna logika i primenjeni SQL nisu menjani radi ovog popravka testa. U generisanim tipovima uklonjen je samo suvišan prazan red na kraju datoteke.

**Customer Chrome:** anoniman izbor → registracija bez mejla → profil → povratak na isti termin → refresh → rezervacija za drugu osobu. Server uspešno upisuje zahtev čiji odgovor browser odbacuje; ponovljeni isti ključ vraća jednu rezervaciju i jedno obaveštenje. Drugi nalog ne vidi termin i ne može da ga otkaže niti označi tuđe obaveštenje. Čitanje obaveštenja opstaje posle refresh-a, redovno otkazivanje i otkazana istorija opstaju, trajna obaveštenja odgovaraju promenama. Odbijeno pogrešno poreklo zahteva. Javni pregled na 360/390/1280 px bez preliva.

**Owner Chrome:** prijava postojećeg sintetičkog vlasnika bez uslova popunjenog klijentskog profila; gost samo sa imenom i bez naloga/telefona; detalji jasno kažu da nema in-app dostave. Izmena vremena i opcionog telefona normalizuje `064…` u `+381…`, čuva 20 minuta i uvećava verziju. Redovno otkazivanje i oba filtera rade. Drugi ručni termin ostaje **potvrđen posle odbijene konfliktne objave**, a objavljeni sadržaj/revizija su identični stanju pre objave. Običan korisnik vidi zabranu na stranici i dobija **403** sa vlasničkog read API-ja. Kalendari, prozor/fokus, aktivnost i čuvanje/objava sa vraćanjem prolaze na dogovorenim širinama. Vlasnički formular je proveren na sve tri širine.

**Početno i završno stanje:** nije bilo projektnih Node/Playwright procesa ni listenera na 3000/3100/9323. Prethodni paket nije imao konačan izveštaj; njegovi snimci su sačuvani pre ponavljanja. Baza je na početku imala 20 otkazanih rezervacija, uključujući jednu `Owner E2E` iz prekinutog scenarija, bez potvrđenih termina; raspored je već bio vraćen (44/24). Nije bilo potrebe za brisanjem ili oporavkom tuđih podataka. Nakon dijagnostičkih i završnih testova ima 27 otkazanih i **0 potvrđenih** rezervacija. Dva nova jasno sintetička korisnička naloga nastala su u završnim registracionim tokovima; ne prenose se u produkciju.

SQL poređenje pre/posle završnog paketa potvrđuje tačno vraćene `draft`, `published` i oba razmaka. Revizije su 46/24 pre paketa i **50/26** posle; početne revizije nastavka bile su 44/24. Postojeća pauza 3. novembra 10:40–11:00 ostaje. Nema potvrđenih preklopljenih parova, nedostajućeg confirmation audita ili confirmation obaveštenja povezanim korisnicima. Test otkazuje samo sopstvene označene rezervacije, ne briše istoriju/audit/revizije.

**Prethodno stvarno integraciono izvršavanje:** korisnikova predaja potvrđuje **7 PASS grupa** iz [check-booking-live.mjs](../../scripts/check-booking-live.mjs): isti/preklapajući termin, isti ključ/izgubljen odgovor, privatnost, tri publication trke, customer/manual konkurencija i bezbedna linked izmena sa obaveštenjem. Prvih pet grupa ima detaljan vremenski zapis u prethodnoj faznoj predaji. Ovih sedam grupa **nije ponovo izvršavano u ovom nastavku**; novi dokazi su ceo Chrome paket, izolovane regresije i SQL readback. Negativni cross-location kandidat je van smene druge lokacije; ne predstavlja dva nezavisno važeća međulokacijska termina.

Četiri cloud migracije su pregledane i nisu ponavljane; tačno mapiranje je u [DEPLOYMENT.md](../DEPLOYMENT.md). Faze 7–10 su **Ready for review**, bez pretpostavljenog korisničkog prihvatanja. Faza 11 ostaje odložena. Telefon + lozinka, stvarni identitet/oporavak/vlasnik, produkciona konfiguracija, kontakti, hosting i operativni oporavak ostaju zasebni završni poslovi. Izolovani i Chrome rezultati nisu potvrda pune produkcione A01–A20 matrice.

## Nastavak faze 7 — 3. novembar 2026.

- `npm.cmd run test:browser`: **7/7 prolazi u instaliranom Google Chrome-u** (`channel: chrome`), na gotovom testnom buildu. Provereni su korisnički/vlasnički pristup, registracija/profil, kalendari/prozor/fokus na 360/390/1280 px, aktivnost/poreklo zahteva i čuvanje/objava uz vraćanje testne smene. To su postojeći tokovi faza 1–6, ne booking UI. Jedan novi sintetički registracioni nalog ostaje samo u test projektu; raspored je vraćen na raniji sadržaj, revizije ostaju uvećane. Bez slanja mejla.

- `npm.cmd --prefix supabase/tests test`: **104 prolazne provere** = 45 temelj + 17 aktivnost/sesije + 12 raspored + 6 dostupnost + 24 booking grupe. PGlite, sintetičke Auth/session fixtures i sekvencijalne transakcije; **nije dokaz stvarne konkurentnosti**.
- Booking provere obuhvataju nezavisno GiST range-exclusion ograničenje protiv preklapanja (i između lokacija), idempotenciju, pristup tuđim podacima, rollback neuspelog obaveštenja, rokove i trajne događaje. Konfliktna objava ostavlja rezervacije/događaje/javni raspored nepromenjene; čak ni ovlašćeni vlasnik nema novi RPC za masovno otkazivanje. Pojedinačna redovna otkazivanja mogu rešiti konflikt.
- `npm.cmd run test:auth`, `test:availability`, `test:booking`: **5 + 14 + 4 prolazne lokalne provere**. `npm.cmd run lint` i `git diff --check` prolaze. `npm.cmd run build:test` prolazi; prvi sandbox pokušaj je završio worker `spawn EPERM`, dozvoljeni ponovljeni lokalni build van sandbox-a je uspešan.
- Stvarni `check-supabase.mjs` i `check-auth-no-email.mjs` prolaze na testnom projektu: 2 lokacije, 7 usluga, privatnost javnog API-ja i privremena prijava bez potvrde mejla. Bez novih naloga, rezervacija ili mejla u tim proverama.
- `node --experimental-strip-types --env-file=.env.test.local scripts/check-booking-live.mjs --preflight`: **FAIL / MIGRATION_MISSING**, `PGRST202` za booking RPC. Ovo je potvrđen nedostajući preduslov, a ne prolaz booking provera. Puna skripta sa stvarnim paralelnim HTTP zahtevima je pripremljena i lintovana, ali još **nije izvršena**. Nakon preflight-a prvo pregledati/primeniti migraciju samo u test projektu, zatim izvršiti punu skriptu i zabeležiti odgovore i readback.

## Aktuelni zbir — faze 1–6, 3. novembar 2026.

- `npm.cmd --prefix supabase/tests test`: **80 prolaznih SQL provera** (45 temelj, 17 aktivnost/sesije, 12 raspored, 6 kontekst dostupnosti). Izolovani PGlite; Auth sesije su fixtures, ne servis Supabase Auth.
- `npm.cmd run test:availability`: **14 prolaznih grupa vremenskih provera**, uključujući primere iz PRD-a, 15 minuta, 14 dana, poluotvorene intervale, pauze, putovanje, obe DST promene i drugu zonu uređaja.
- `npm.cmd run test:auth`: **5 prolaznih provera** lokalne validacije i bezbednog povratnog URL-a.
- Stvarni test projekat: `check-schedule-owner-live.mjs` ima **6 prolaznih provera** prava, validacije, konkurentnih revizija, objave i izolacije nacrta. Dva zahteva iste revizije: tačno jedan upis, finalna revizija uvećana samo za 1. Drugi mrežni odgovor ističe; to nije dokaz uredne HTTP poruke konflikta. Urednik zato ima rok od 12 s i traži osvežavanje da se proveri stanje.
- `check-availability-live.mjs`: **5 prolaznih provera**, javni Supabase RPC i lokalni API za obe lokacije/usluge, validacija parametara i `no-store`. Dana 3. novembra rezultat za objavljeni 4. novembar je Zrenjanin 15/7, Neuzin 9/4 početaka za 20/40 min.
- `npm.cmd run test:browser`: **5 prolaznih browser provera** na završnom buildu: kalendari/prozor/fokus na 360/390/1280 px, ispravna aktivnost 204 uz odbijanje tuđeg porekla 403, vlasnička prijava i izmena/čuvanje/objava uz vraćanje originalne smene. `npm.cmd run lint`, `npm.cmd run build:test` i završni `git diff --cached --check` prolaze. Nema slanja mejla ni upisa u buduću produkciju. Detalji i sledeća faza su u najnovijem [handoff-u](../../../PHASE_PLAN.md).

Istorijski zapis ispod ostaje evidencija početne faze; ne predstavlja aktuelni ukupan obim.

### Ispravka registracije — 3. novembar 2026.

Posle prijavljenog 404 nakon registracije dodate su dve stvarne browser regresije za korisničko preusmeravanje i novu registraciju bez mejla. **Svih 7 browser testova prolazi**, uključujući postojećeg vlasnika i kalendare na tri širine. Prolaze i build, lint i 5 lokalnih Auth provera. Običan nalog ide na profil/„Moji termini“; star ili ručno izmenjen povratak na `/raspored` ne daje vlasnički pristup. Nova registracija ostavlja jedan sintetički nalog u test projektu po pokretanju. Nema izmene SQL/RLS pravila ili dodele vlasničke uloge. Detalji su u najnovijem handoff-u.

Datum: 31.10.2026.

**Rezultat: PASS — 45 provera.**

Izvršena komanda iz `vule-still/`:

```powershell
npm.cmd --prefix .\supabase\tests test
```

Okruženje: Node.js 24.15.0, PGlite 0.5.14, PostgreSQL 18.6 u novoj bazi u memoriji. Nisu korišćeni Docker, produkcioni URL/ključ, Supabase mrežni servis ili stvarno slanje mejlova.

Proverene migracije:

- `20261031000100_foundation.sql`
- `20261031000200_reference_data.sql`

Proverene oblasti:

- Izvršavanje obe migracije, pet tabela i RLS na svakoj tabeli.
- Dve lokacije, jedan frizer i sedam usluga sa potvrđenim kategorijama i početnim trajanjem.
- Kreiranje praznog profila i dopuna za ranije kreiran Auth nalog.
- Ignorisanje pokušaja dodele prava preko korisničkih metapodataka.
- Razdvajanje posetioca, običnog korisnika i administratora.
- Čitanje/izmena samo sopstvenog profila; zaštita admin prava, zabrane, ID-ja i vremenskih oznaka.
- Neaktivni javni podaci i zaštićen prikaz frizera.
- Dodela admina samo postojećem verifikovanom nalogu; ponavljanje bez duplikata; odbijanje prepisivanja drugog admina.
- Ograničenje na jednog admina i jednog frizera, uključujući pokušaj zaobilaženja singleton polja.
- Trajanja u pozitivnim koracima od 10 minuta, bez dodatnog poslovnog maksimuma.
- Kanonski telefonski format, međunarodni kontakt i dozvoljen zajednički telefon različitih naloga.
- Zaštita internog helper-a i trigger funkcija od anonimnog izvršavanja.
- Integritet veza pri brisanju Auth naloga.

Prva iteracija testa je za odbijeno brisanje admina očekivala SQLSTATE `23503`; engine je ispravno prijavio RESTRICT grešku `23001`. Test sada prihvata oba odgovarajuća koda i dodatno potvrđuje da su članstvo i profil ostali sačuvani. Migracija zbog toga nije menjana.

## Šta ovim nije potvrđeno

`auth.users`, `auth.uid()` i korisničke uloge predstavljeni su izolovanim testnim modelom. Nisu pokrenuti pravi Supabase Auth, PostgREST/Data API, OTP, SMTP ili Next.js integracija. Ovaj rezultat nije potvrda celokupnih kriterijuma A01–A20 niti produkcionog ponašanja.

Pre primene i javnog rada potrebna je provera na pravom razvojnom Supabase okruženju, uključujući prijavu stvarnim kodom, tokene i direktne API pokušaje pristupa tuđim podacima. Produkcioni projekat je ostao neizmenjen.

## Naknadna provera i primena — 01.11.2026.

Svih 45 provera ponovo prolazi uz treću migraciju za objedinjena pravila čitanja. Prve dve lokalne datoteke preimenovane su prema stvarnim Supabase verzijama; SQL im je sačuvan. Trenutni redosled:

- `20261101215730_foundation.sql`
- `20261101215737_reference_data.sql`
- `20261101220017_consolidate_read_policies.sql`

Početni paket je nakon povezivanja dodatka primenjen na potvrđen cloud projekat. Na stvarnom javnom API-ju provereni su katalog, odbijanje anonimnog pristupa privatnim tabelama i neizložen interni schema. Nisu kreirani Auth korisnici niti slati kodovi. Detalji: [zapisnik primene](../DEPLOYMENT.md).
