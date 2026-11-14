# Raspored — faza 5

## Urednik u zasebnoj administraciji — 3.11.2026. (najnovije)

Ulaz je `/administrator`; vlasnička navigacija vodi na rezervacije, **Radno vreme** (`/raspored`) i **Uobičajena nedelja** (`/administrator/sablon`). Svi ovi ekrani imaju zasebno zaglavlje bez javnih sekcija. Radno vreme i rezervacija klijenta jasno su odvojene radnje.

Konkretni kalendari već podržavaju smene/pauze svih sedam dana, više smena i neradne dane. Za rad nedeljom pritisnuti `+` u koloni „Ned“; za potpuno neradan dan ukloniti njegove smene na obe lokacije. Objava ostaje eksplicitna, uz postojeću zaštitu rezervacija i jednog frizera.

Pregled stare šeme otkrio je da sam šablon ima `weekday 1–6`, jednu smenu po danu/lokaciji, bez pauza i bez owner urednika. Dve nove [migracije](DEPLOYMENT.md) dodaju dan 7, pauze, reviziju i podrazumevani razmak. Uobičajena nedelja zadržava jednu smenu po danu/lokaciji; za više smena koristi se konkretan kalendar. `get_owner_schedule_template`/`save_owner_schedule_template` proveravaju sesiju/članstvo. `prepare_schedule_week` čita šablon i razmak pod deljenim zaključavanjem; postojeću nedelju čuva pomoću `ON CONFLICT DO NOTHING`. Čuvanje šablona nema upis u postojeće nedelje.

Prošlo je 7 novih izolovanih template grupa, stvarni konkurentni template upisi, priprema novog budućeg nacrta i Chrome save/reload bez prepisivanja nedelje. Chrome je otvorio nedelju 8.11. sa smenom 10–12 i pauzom 11–11:20: dostupno je 5 početaka od 20 minuta i nema početka u pauzi; posle uklanjanja smene i objave javni razlog je `closed`. Prvobitni šablon/nacrt/objavljeni sadržaj vraćeni su; konačne revizije 74/42, template 12. [Uputstvo vlasniku](../../docs/ADMINISTRACIJA.md), [rezultati](tests/RESULTS.md).

## Aktuelni ugovor faze 7 — nastavak 3. 11. 2026.

Najnovija odluka menja stariji ugovor ispod: konfliktna objava se **odbija bez otkazivanja**. Ne uvodi se grupna potvrda uticaja niti javni RPC za masovno otkazivanje. Primenjena booking migracija zaključava zajednički red frizera pre objave i potvrde rezervacije; objava zatim zaključava nedelju i ponovo proverava rezervacije, smene i putovanje prema susednim nedeljama. Nacrt ostaje dozvoljen. Zaštita započetih termina ostaje. Urednik razlikuje konflikt rezervacija, putovanja, zastarelu reviziju i nepoznat mrežni ishod.

Ovo je stanje **Vule-still-test**. Faza 7 je prošla stvarne paralelne zahteve u prethodnom nastavku; završni Chrome paket sada ima 12/12 prolaza. Vlasnik je kroz UI uneo rezervaciju i sačuvao konfliktan nacrt: objava je odbijena, rezervacija ostaje potvrđena i objavljeni snimak/revizija ostaju isti. Test zatim redovno otkazuje samo sopstveni sintetički termin i vraća originalni nacrt uz kontrolu revizije. Završno SQL poređenje potvrđuje isti sadržaj obe lokacije, pauze i razmak; revizije 50/26 ostaju kao istorija. [Migracije](DEPLOYMENT.md) se ne ponavljaju; [rezultati](tests/RESULTS.md) razlikuju izolovane i stvarne provere.

Stanje 3. 11. 2026: raspored i javni `published_schedule` rade na **Vule-still-test** (`xfbjgxtgvlyndonhlupm`). Raniji zapis o HTTP 404 više nije aktuelan. Tekuća testna nedelja od 2. novembra je objavljena. Urednik ima dva nedeljna kalendara, Zrenjanin i Neuzin. Buduća produkcija `usokysukvtgtvrtxnjai` nije menjana ovim nastavkom.

SQL Editor ranije nije upisivao CLI istoriju migracija. Postojanje rasporeda i dostupnosti potvrđeno je stvarnim RPC/API testovima; nemoj ponavljati migracije bez pregleda stvarne šeme. Šema očekivana za ovaj checkpoint opisana je lokalnim migracijama `20261102210000_schedule_foundation.sql` i `20261102220000_availability_context.sql`.

## Ugovor podataka

- `schedule_templates`: početnih šest dana, po dve smene dnevno; Zrenjanin 10–15 i Neuzin 17–20. Nedelja nema početni red. Šablon samo priprema nacrt.
- `schedule_weeks`: ponedeljak po lokalnom datumu Srbije; privatni `draft` i javno objavljeni snimak `published`, odvojene revizije i razmaci između lokacija. Dan bez smene je neradni dan ili odsustvo. Pauze su intervali unutar smene. Vremena su minuti od lokalne ponoći, bez fiksnog UTC pomaka.
- `prepare_schedule_week` pravi nacrt, `save_schedule_draft` traži očekivanu reviziju, `publish_schedule_week` atomskim upisom snima nacrt, a `published_schedule` vraća samo objavljene činjenice. Nema automatskog objavljivanja. Direktan pristup tabelama nije odobren browser ulogama; vlasničke funkcije proveravaju `app_private.is_admin()`.
- Validacija odbija nepostojeću/neaktivnu lokaciju, datum van nedelje, preklop smena, nedovoljan razmak između lokacija, neispravnu pauzu i duplikat. Razmak može biti 0 ili pozitivan broj minuta.

## Istorijski predlog pre faze 7 — zamenjen ugovorom iznad

Upis rezervacije i objava rasporeda moraju zaključati **isti red** `schedule_weeks` za tu nedelju u transakciji pre provere dostupnosti. Sama javna RPC funkcija nije rezervacija. Pre uključivanja rezervacija, objava promene koja utiče na buduće rezervacije mora dobiti pregled tačno pogođenih termina i eksplicitnu potvrdu; zastareo pregled odbija se posle ponovne provere pod zaključavanjem. Trenutna funkcija objave nema taj pregled jer rezervacije još ne postoje. Ne uključivati upise rezervacija dok to nije integrisano.

## Provera i korišćenje na privremenom projektu

1. Pokrenuti `npm.cmd run dev:test`, pa otvoriti `http://127.0.0.1:3100/raspored`. Koristi se kontrolisano dodeljen sintetički vlasnik samo u test projektu. Stvarni vlasnički mejl, SMTP i produkcioni bootstrap čekaju završnu fazu 12.
2. Izabrati nedelju. Ako ne postoji, pripremiti je iz šablona. Klik na smenu otvara izmenu; `+` u zaglavlju dana dodaje smenu u toj lokaciji. Podržane su više pauza i uklanjanje smene kao neradni dan. Escape/„Odustani“ odbacuje izmenu u prozoru.
3. „Sačuvaj nacrt“ čuva obe lokacije, ali ne menja javni snimak. „Objavi nedelju“ izričito objavljuje sačuvani nacrt. Dugmad „Nacrt“/„Objavljeno“ porede verzije; objavljeni prikaz se ne uređuje.
4. `node --env-file=.env.test.local scripts/check-schedule-owner-live.mjs` koristi postojeće sintetičke naloge iz ignorisanog lokalnog JSON fajla. Proverava prava, istovremeno čuvanje, validaciju, objavu i izolaciju nacrta. Čuva prvobitni nacrt i objavljuje tekuću testnu nedelju; testne lozinke ne idu u Git. Stvarni nalaz: tačno jedan istovremeni upis menja reviziju; drugi odgovor ističe. Ponovno čitanje potvrđuje samo jednu novu reviziju. Urednik prekida čekanje posle 12 s i traži osvežavanje radi provere stanja; ne pretpostavlja da neuspešna mrežna potvrda znači da ništa nije upisano.
5. `npm.cmd run test:browser` proverava stvarni vlasnički interfejs na 360, 390 i 1280 px i izmenu/čuvanje/objavu sa vraćanjem originalne smene. Potrebni su pokrenut testni server i postojeći sintetički vlasnik/korisnik. Test registracije dodatno kreira jedan jasno označen sintetički korisnički nalog po pokretanju isključivo u test projektu, bez slanja mejla. Novi nalozi nemaju vlasnička prava; direktan pristup kalendarima prikazuje objašnjenje i povratak na korisnički nalog.

Vraćanje aplikacije: prestati koristiti urednik i javni RPC pre eventualnog uklanjanja šeme. Migracija je aditivna i nema automatski `down`; ne brisati objavljene podatke bez odvojene odluke i izvoza. Buduća produkcija nema ovu migraciju.
