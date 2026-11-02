# Rezultat početnih SQL provera

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
