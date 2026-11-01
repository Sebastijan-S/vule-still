# Vule Still — početni SQL paket

Status 01.11.2026: početne migracije su primenjene na potvrđen Supabase projekat. Next.js klijenti su podešeni, a stvarni javni API je provereno dostupan sa publishable ključem. Rezultati i preostala ograničenja: [zapisnik primene](DEPLOYMENT.md).

## Potvrđeni obim i okruženja

Izvori su `../../docs/PRD.md`, `../../docs/SOW.md`, `../../docs/ODLUKE.md` i kasniji odgovori korisnika. Najnoviji odgovori imaju prednost.

- Projektujemo celu bazu, a prvo pripremamo naloge, administratorski pristup, lokacije, jednog frizera i usluge.
- Supabase projekat `usokysukvtgtvrtxnjai` namenjen je budućoj produkciji.
- Razvoj i testiranje treba odvojiti od produkcionih podataka.
- Docker se ne instalira. SQL provere koriste odvojenu bazu u memoriji; nakon povezivanja Supabase dodatka primenjen je početni paket na cloud, bez upisa test korisnika.
- Početni admin mejl: `sekosansebastijan@gmail.com`. Adresa sama po sebi ne dodeljuje administratorsko pravo.

## Datoteke i kasniji redosled primene

| Datoteka | Namena |
| --- | --- |
| `migrations/20261101215730_foundation.sql` | Pet tabela, ključevi, ograničenja, trigger profila, RLS i eksplicitne dozvole |
| `migrations/20261101215737_reference_data.sql` | Dve lokacije, jedan frizer i sedam potvrđenih usluga |
| `migrations/20261101220017_consolidate_read_policies.sql` | Objedinjena pravila čitanja uz očuvanje istih ovlašćenja |
| `scripts/bootstrap_admin.sql` | Ručna dodela prvog admina nakon stvarne verifikacije njegovog Auth naloga |
| `tests/foundation.test.mjs` | Izolovana provera SQL ograničenja i pristupa kroz PostgreSQL u memoriji |
| `tests/auth-fixture.sql` | Isključivo zamena za Auth objekte u testu; nikada se ne primenjuje na Supabase |

Migracije su namenjene jednom izvršavanju, po redosledu naziva, kao vlasnik baze/migration role. Ne preskakati prvu migraciju i ne pokretati ih ponovo preko postojeće šeme. Namerno ne prikrivaju razlike pomoću `CREATE TABLE IF NOT EXISTS` ili prepisivanja postojećih poslovnih podataka.

Svaka migracija ima transakciju. Ako klijent ostane u neuspešnoj transakciji posle greške, izvršiti `ROLLBACK` i pregledati uzrok pre ponavljanja. Za buduće izmene već primenjenih migracija dodaje se nova datoteka.

## Početne tabele

| Tabela | Ključni podaci | Veze i pravila |
| --- | --- | --- |
| `profiles` | `id`, ime, prezime, telefon, `booking_blocked`, vremenske oznake | `id` je ID iz `auth.users`; nepotpun profil je dozvoljen do rezervacije |
| `admin_memberships` | Jedan zapis, `user_id`, vreme dodele | FK na `auth.users`; ograničenje dozvoljava najviše jednog admina |
| `locations` | ID, slug, naziv, adresa, telefon, redosled, aktivnost | Početno Zrenjanin i Neuzin; stvarni kontakti još nisu dostavljeni |
| `staff` | ID zajedničkog resursa, opciono ime, vremenske oznake | Najviše jedan frizer; nije vezan za životni ciklus admin naloga |
| `services` | ID, slug, naziv, kategorija, trajanje, redosled, aktivnost | Kategorije `standard` i `premium`; trajanje je pozitivan umnožak od 10 minuta |

`auth.users` vodi Supabase Auth. Ne pravimo duplikat identiteta, tabelu lozinki ili sopstvenu tabelu kodova za prijavu.

Adrese, javni telefoni i lično ime frizera ostaju `NULL`; ne izmišljaju se podaci. Standardne usluge počinju sa 20, premium sa 40 minuta. Nema dodatnog poslovnog maksimuma trajanja; smeštanje u slobodnu smenu proverava se u budućim transakcijama rezervisanja. SQL tip `integer` ima svoje tehničke granice.

## Pristup podacima

| Operacija | Posetilac | Prijavljeni korisnik | Verifikovani admin |
| --- | --- | --- | --- |
| Aktivne lokacije i usluge | Čita | Čita | Čita |
| Neaktivne lokacije i usluge | Nema pristup | Nema pristup | Čita |
| Profil | Nema pristup | Čita svoj | Čita sve |
| Izmena imena, prezimena i telefona | Nema pristup | Menja svoje | Menja svoje |
| Čitanje frizera | Nema pristup | Nema pristup | Čita |
| Dodela admin prava | Nema pristup | Nema pristup | Nema direktan upis iz browser sesije |
| Izmena zabrane, usluga i rasporeda | Nema pristup | Nema pristup | Buduće kontrolisane operacije; trenutno nisu otvorene |

Vlasnik baze i `service_role` imaju privilegovan pristup za održavanje. Njihovi kredencijali se ne koriste u pregledaču. Publishable ključ nije pristup za izvršavanje ovih migracija.

RLS ograničava redove. Dozvola za `UPDATE` profila dodatno je ograničena na tri kolone: `first_name`, `last_name`, `phone`. Čak ni adminova obična browser sesija ne može direktno promeniti `booking_blocked`, identitet, vremenske oznake ili admin članstvo.

Pomoćne funkcije su u `app_private`, sa fiksnim `search_path` i ograničenim izvršavanjem. **Ne dodavati `app_private` u Data API Exposed schemas.** `is_admin()` proverava samo trenutno prijavljeni ID, posebno dodeljeno članstvo i verifikovan Auth mejl. Metapodaci koje korisnik može da pošalje pri registraciji ne dodeljuju prava.

Admin izmene usluga i zabrane naloga nisu sada omogućene direktnim `UPDATE` pravilima: za njih su kasnije potrebne transakcije sa proverom rezervacija, obaveštenjima i evidencijom promena.

## Telefoni i profil

Potvrđeno je da korisnik uređuje svoje ime, prezime i telefon. Za pristup administraciji nije potreban popunjen profil; za korisničku rezervaciju biće obavezna sva tri podatka.

SQL čuva telefon u jednom kanonskom međunarodnom formatu, npr. `+381641234567`. Budući interfejs treba da prihvati srpski lokalni unos, pretvori ga u međunarodni format i validira međunarodne brojeve pre slanja u bazu. SQL regex proverava samo oblik; ne dokazuje da broj postoji ili pripada korisniku. SMS potvrda nije u obimu.

Tehnička odluka: telefon nije jedinstven ključ naloga. Identitet je Auth ID; ovo ne uvodi novo pravilo zabrane za različite naloge koji koriste zajednički kontakt.

Za buduće rezervacije važi potvrđeno pravilo: kontakt prijavljenog korisnika čita se iz trenutnog profila, bez kopije telefona u rezervaciji. I prošli termini zato prikazuju aktuelan kontakt. Ručna rezervacija imaće svoje ime i opcioni telefon, bez mejla i bez automatskog kreiranja/povezivanja naloga.

## Prvi administrator

`bootstrap_admin.sql` se pokreće tek kada izabrana adresa stvarno završi proveru mejla kroz Supabase Auth. Skripta:

1. Zahteva tačno jedan verifikovan nalog sa izabranim mejlom.
2. Dodeljuje pravo njegovom stabilnom Auth ID-ju.
3. Pri ponavljanju za isti nalog ne pravi novi zapis.
4. Odbija da zameni drugog postojećeg administratora.

Ne kreira korisnika, ne označava mejl kao verifikovan i ne daje pravo automatski pri registraciji. Trenutni admin nalog ne može se slučajno obrisati dok na njega upućuje članstvo. Prenos vlasništva i pravila brisanja naloga nisu implementirani ovim paketom.

## Provere bez Dockera

Iz korena Next.js projekta:

```powershell
npm.cmd --prefix .\supabase\tests ci --ignore-scripts --no-audit --no-fund
npm.cmd --prefix .\supabase\tests test
```

PGlite je izolovana testna zavisnost u `tests/package.json`, zaključana lockfile-om. Ne menja zavisnosti Next.js aplikacije. Test koristi novu bazu u memoriji i nema produkcioni URL, ključ, mrežnu konekciju ili trajni direktorijum za podatke.

Proveravaju se izvršavanje migracija, početni podaci, RLS i dozvole za posetioca, korisnika i admina, zaštita od samododele prava, tuđi profili, neaktivni podaci, singleton ograničenja, trajanja, kontakti i ručno postavljanje admina.

Izvršeni rezultat: **45 provera je prošlo** u PGlite/PostgreSQL okruženju u memoriji. Detalji i granice nalaze se u [zapisniku provere](tests/RESULTS.md).

**Granica memorijske provere:** PostgreSQL pravila se izvršavaju, ali `auth.users`, `auth.uid()` i uloge su testni model. Posebno je zatim provereno stvarno anonimno čitanje Data API-ja i odbijanje pristupa privatnim tabelama. Stvarni signup/OTP, autentifikovani zahtevi i globalna neaktivnost zahtevaju naredne razvojne integracione provere.

Klijenti su u `src/lib/supabase/`, generisani tipovi u `src/types/database.ts`, a osvežavanje sesije u `src/proxy.ts`. Ponovljiva provera stvarnog API-ja je `npm run check:supabase`; ona ne vrši upise. `.env.local` je podešen za potvrđeni cloud projekat i ignorisan u Gitu.

## Naredne migracije i otvorene stavke

Prema postojećem SoW-u, naredne celine su:

- `account_activity`, `session_access`: 30 dana ukupne neaktivnosti i važenje pristupa preko uređaja; pravilo još nije implementirano ovom migracijom.
- `weekly_templates`, `schedule_weeks`, `schedule_revisions`, `shifts`, `blocks`, `scheduling_settings`: nacrti/objave, smene, pauze i putovanje.
- `bookings`, `notifications`, `audit_events`, `mutation_keys`: rezervacije, snimak usluge i trajanja, trajna obaveštenja, trag promena i ponovljeni zahtevi.

Zaštita od duplog rezervisanja, rokovi 15/30 minuta i danas do danas + 14 uključivo dolaze sa tim transakcijama. Ne predstavljati početni paket kao završenu aplikaciju za rezervisanje.

Još nisu određeni stvarni javni kontakti, domen/SMTP i način izvođenja pune razvojne Supabase integracione provere bez Dockera. Rokovi čuvanja podataka i konačna politika brisanja takođe nisu rešeni ovim SQL paketom; nisu dodate automatske operacije brisanja istorije.

## Tehnički izvori

- [Supabase: migracije](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase: korisnički podaci i Auth trigger](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: zaštita kolona](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Supabase: prava izvršavanja funkcija](https://supabase.com/docs/guides/database/functions)
- [PGlite: Postgres u memoriji](https://pglite.dev/docs/)
