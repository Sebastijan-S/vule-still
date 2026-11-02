# Raspored — faza 5

Stanje 3. 11. 2026: raspored i javni `published_schedule` rade na **Vule-still-test** (`xfbjgxtgvlyndonhlupm`). Raniji zapis o HTTP 404 više nije aktuelan. Tekuća testna nedelja od 2. novembra je objavljena. Urednik ima dva nedeljna kalendara, Zrenjanin i Neuzin. Buduća produkcija `usokysukvtgtvrtxnjai` nije menjana ovim nastavkom.

SQL Editor ranije nije upisivao CLI istoriju migracija. Postojanje rasporeda i dostupnosti potvrđeno je stvarnim RPC/API testovima; nemoj ponavljati migracije bez pregleda stvarne šeme. Šema očekivana za ovaj checkpoint opisana je lokalnim migracijama `20261102210000_schedule_foundation.sql` i `20261102220000_availability_context.sql`.

## Ugovor podataka

- `schedule_templates`: početnih šest dana, po dve smene dnevno; Zrenjanin 10–15 i Neuzin 17–20. Nedelja nema početni red. Šablon samo priprema nacrt.
- `schedule_weeks`: ponedeljak po lokalnom datumu Srbije; privatni `draft` i javno objavljeni snimak `published`, odvojene revizije i razmaci između lokacija. Dan bez smene je neradni dan ili odsustvo. Pauze su intervali unutar smene. Vremena su minuti od lokalne ponoći, bez fiksnog UTC pomaka.
- `prepare_schedule_week` pravi nacrt, `save_schedule_draft` traži očekivanu reviziju, `publish_schedule_week` atomskim upisom snima nacrt, a `published_schedule` vraća samo objavljene činjenice. Nema automatskog objavljivanja. Direktan pristup tabelama nije odobren browser ulogama; vlasničke funkcije proveravaju `app_private.is_admin()`.
- Validacija odbija nepostojeću/neaktivnu lokaciju, datum van nedelje, preklop smena, nedovoljan razmak između lokacija, neispravnu pauzu i duplikat. Razmak može biti 0 ili pozitivan broj minuta.

## Ugovor za fazu 7

Upis rezervacije i objava rasporeda moraju zaključati **isti red** `schedule_weeks` za tu nedelju u transakciji pre provere dostupnosti. Sama javna RPC funkcija nije rezervacija. Pre uključivanja rezervacija, objava promene koja utiče na buduće rezervacije mora dobiti pregled tačno pogođenih termina i eksplicitnu potvrdu; zastareo pregled odbija se posle ponovne provere pod zaključavanjem. Trenutna funkcija objave nema taj pregled jer rezervacije još ne postoje. Ne uključivati upise rezervacija dok to nije integrisano.

## Provera i korišćenje na privremenom projektu

1. Pokrenuti `npm.cmd run dev:test`, pa otvoriti `http://127.0.0.1:3100/raspored`. Koristi se kontrolisano dodeljen sintetički vlasnik samo u test projektu. Stvarni vlasnički mejl, SMTP i produkcioni bootstrap čekaju završnu fazu 12.
2. Izabrati nedelju. Ako ne postoji, pripremiti je iz šablona. Klik na smenu otvara izmenu; `+` u zaglavlju dana dodaje smenu u toj lokaciji. Podržane su više pauza i uklanjanje smene kao neradni dan. Escape/„Odustani“ odbacuje izmenu u prozoru.
3. „Sačuvaj nacrt“ čuva obe lokacije, ali ne menja javni snimak. „Objavi nedelju“ izričito objavljuje sačuvani nacrt. Dugmad „Nacrt“/„Objavljeno“ porede verzije; objavljeni prikaz se ne uređuje.
4. `node --env-file=.env.test.local scripts/check-schedule-owner-live.mjs` koristi postojeće sintetičke naloge iz ignorisanog lokalnog JSON fajla. Proverava prava, istovremeno čuvanje, validaciju, objavu i izolaciju nacrta. Čuva prvobitni nacrt i objavljuje tekuću testnu nedelju; testne lozinke ne idu u Git. Stvarni nalaz: tačno jedan istovremeni upis menja reviziju; drugi odgovor ističe. Ponovno čitanje potvrđuje samo jednu novu reviziju. Urednik prekida čekanje posle 12 s i traži osvežavanje radi provere stanja; ne pretpostavlja da neuspešna mrežna potvrda znači da ništa nije upisano.
5. `npm.cmd run test:browser` proverava stvarni vlasnički interfejs na 360, 390 i 1280 px i izmenu/čuvanje/objavu sa vraćanjem originalne smene. Potrebni su pokrenut testni server i postojeći sintetički vlasnik/korisnik. Test registracije dodatno kreira jedan jasno označen sintetički korisnički nalog po pokretanju isključivo u test projektu, bez slanja mejla. Novi nalozi nemaju vlasnička prava; direktan pristup kalendarima prikazuje objašnjenje i povratak na korisnički nalog.

Vraćanje aplikacije: prestati koristiti urednik i javni RPC pre eventualnog uklanjanja šeme. Migracija je aditivna i nema automatski `down`; ne brisati objavljene podatke bez odvojene odluke i izvoza. Buduća produkcija nema ovu migraciju.
