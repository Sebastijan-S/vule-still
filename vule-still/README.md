# Vule Still

Next.js + TypeScript aplikacija sa Supabase osnovom. Početnih pet tabela i referentni podaci postavljeni su 01.11.2026. Stranica je još starter; prijava, rezervacije i administrativni interfejs dolaze u narednim fazama.

## Lokalno pokretanje

```powershell
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Pre prvog pokretanja podesiti `.env.local` prema `.env.example`: Supabase URL i publishable ključ. Za ovaj radni folder konfiguracija je već postavljena. `.env.local` je ignorisan u Gitu.

Adresa aplikacije: http://localhost:3000.

## Provere

```powershell
npm.cmd run build
npm.cmd run check:supabase
npm.cmd --prefix .\supabase\tests ci --ignore-scripts --no-audit --no-fund
npm.cmd --prefix .\supabase\tests test
```

`check:supabase` proverava stvarni javni API i zabranu anonimnog pristupa privatnim podacima. Izvršava samo čitanje: ne pravi naloge, ne šalje mejlove i ne upisuje podatke.

SQL testovi koriste novu PGlite bazu u memoriji, odvojenu od cloud podataka, bez Dockera. Auth objekti u tom testu su zamene, pa stvarni OTP i autentifikovani API tokovi zahtevaju posebne integracione provere.

## Struktura

- `src/lib/supabase/client.ts`: browser klijent sa publishable ključem.
- `src/lib/supabase/server.ts`: klijent vezan za cookies tekućeg zahteva.
- `src/lib/supabase/proxy.ts` i `src/proxy.ts`: provera/osvežavanje tokena i prosleđivanje cookies/cache zaglavlja; ne predstavljaju potpunu autorizaciju niti pravilo 30 dana.
- `src/types/database.ts`: tipovi generisani iz stvarnog projekta.
- `supabase/migrations/`: primenjene migracije sa usklađenim verzijama.
- `supabase/scripts/bootstrap_admin.sql`: dodela admina tek posle verifikacije dogovorenog naloga.
- `public/fonts/`: lokalni Manrope font i njegova licenca.

## Trenutni obim

Baza ima `profiles`, `admin_memberships`, `locations`, `staff` i `services`, sa RLS pravilima i ograničenim kolonama za uređivanje profila. Početni katalog sadrži Zrenjanin, Neuzin, jednog frizera i sedam usluga.

Cloud projekat je namenjen budućoj produkciji. Trenutna lokalna konfiguracija čita njegov javni katalog; sintetički SQL testovi su odvojeni u memoriji. Pre testiranja stvarnih korisničkih upisa treba obezbediti izolovano razvojno Auth/API okruženje.

Administratorski nalog nije unapred kreiran ili veštački verifikovan. Prvo sledi prava prijava kodom na dogovoreni mejl, zatim posebna dodela ovlašćenja. U aplikaciji se koristi publishable ključ; privilegovani pristup za migracije ostaje kroz povezani Supabase alat.

## Dokumentacija

- [Supabase SQL i pristup](supabase/README.md)
- [Primenjene migracije i provere](supabase/DEPLOYMENT.md)
- [Specifikacija aplikacije](../docs/PRD.md)
- [Potvrđene odluke](../docs/ODLUKE.md)

Sledeće celine su prijava/registracija kodom, profil i globalna neaktivnost, zatim raspored i rezervacije. Domen i slanje kodova još nisu podešeni.
