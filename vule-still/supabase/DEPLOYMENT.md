# Primenjeni početni Supabase paket

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
