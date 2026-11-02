# Vule Still

Next.js + TypeScript aplikacija sa Supabase osnovom. Završene su razvojne celine 1–6: privremena prijava lozinkom bez mejla, profil/odjava, neaktivnost naloga, javni sajt, dva kalendara rasporeda i savetodavni API dostupnosti. Razvoj koristi izdvojeni Vule-still-test. Atomske rezervacije su sledeća faza 7; slanje i potvrda mejla, domen i stvarni produkcioni vlasnik čekaju završnu fazu 12.

## Lokalno pokretanje

```powershell
npm.cmd ci
npm.cmd run dev:test
```

Za razvoj podesiti ignorisani `.env.test.local`: Supabase URL `https://xfbjgxtgvlyndonhlupm.supabase.co`, njegov publishable ključ, `VULE_AUTH_MODE=password-test` i `VULE_PHASE3_ACCESS=1`. Koristiti imena promenljivih iz `.env.example`; stvarne ključeve ne unositi u Git. U ovom radnom folderu test konfiguracija već postoji. Skripte `dev:test`, `build:test` i `start:test` proveravaju identitet test projekta pre pokretanja. Postojeći `.env.local` je namenjen budućoj produkciji i nije razvojno okruženje za sintetičke upise.

Adresa test aplikacije: http://127.0.0.1:3100. Vlasnički kalendari: `/raspored`. Nove testne naloge možeš napraviti kroz testnu prijavu; vlasničko članstvo se dodeljuje posebno, nikad samostalnom registracijom.

## Provere

```powershell
npm.cmd run build:test
npm.cmd run lint
npm.cmd run test:auth
npm.cmd run test:availability
node --env-file=.env.test.local scripts/check-supabase.mjs
npm.cmd --prefix .\supabase\tests ci --ignore-scripts --no-audit --no-fund
npm.cmd --prefix .\supabase\tests test
```

`check:supabase` proverava stvarni javni API i zabranu anonimnog pristupa privatnim podacima. Izvršava samo čitanje: ne pravi naloge, ne šalje mejlove i ne upisuje podatke.

`build:test` koristi `.next-phase6-build`, odvojeno od razvojnog `.next-test`. Posle izgradnje `npm.cmd run start:test` prikazuje gotov build na portu 3100; ne pokretati ga dok razvojni server koristi isti port. `test:auth` ne proverava dostavu mejla. `node --env-file=.env.test.local scripts/check-availability-live.mjs` čita cloud RPC i lokalni API dok testni server radi.

Za proveru kalendara: `npx.cmd playwright install chromium`, pokrenut testni server, pa `npm.cmd run test:browser`. Test koristi postojeći sintetički vlasnički nalog iz ignorisanog `.env.phase6-state.local` JSON fajla. Njegova struktura je `{ "owner": { "email": "vule-phase6-owner-<oznaka>@example.invalid", "password": "<lokalna testna lozinka>" }, "customer": { "email": "vule-phase6-customer-<oznaka>@example.invalid", "password": "<druga lokalna testna lozinka>" } }`; naloge i članstvo treba kontrolisano pripremiti na test projektu, ne izmišljati produkcione korisnike. Browser test menja/objavljuje jednu testnu smenu i vraća je. `check-schedule-owner-live.mjs` koristi iste naloge, proverava konkurentne revizije i objavljuje tekuću testnu nedelju.

SQL testovi koriste novu PGlite bazu u memoriji, odvojenu od cloud podataka, bez Dockera. Auth objekti u tom testu su zamene, pa stvarni OTP i autentifikovani API tokovi zahtevaju posebne integracione provere.

## Struktura

- `src/lib/supabase/client.ts`: browser klijent sa publishable ključem.
- `src/lib/supabase/server.ts`: klijent vezan za cookies tekućeg zahteva.
- `src/lib/supabase/proxy.ts` i `src/proxy.ts`: provera/osvežavanje tokena i prosleđivanje cookies/cache zaglavlja; ne predstavljaju potpunu autorizaciju niti pravilo 30 dana.
- `src/types/database.ts`: tipovi generisani iz stvarnog projekta.
- `supabase/migrations/`: primenjene migracije sa usklađenim verzijama.
- `src/lib/availability.ts` i `src/app/api/availability/route.ts`: vremenska pravila i javni API bez upisa rezervacija.
- `src/app/raspored/`: dva kalendara sa nacrtom i objavljenim snimkom.
- `supabase/scripts/bootstrap_admin.sql`: dodela admina tek posle verifikacije dogovorenog naloga.
- `public/fonts/`: lokalni Manrope font i njegova licenca.

## Trenutni obim

Baza test projekta proširena je aktivnošću naloga, dozvoljenim sesijama, nacrtima/objavljenim nedeljama i privatnim temeljem rezervacionih intervala. Katalog sadrži Zrenjanin, Neuzin, jednog frizera i sedam usluga. Browser uloge ne mogu upisivati rezervacije; dostupnost ne predstavlja potvrdu termina.

Projekat `usokysukvtgtvrtxnjai` ostaje buduća produkcija. Sve aktuelne sintetičke Auth/API provere koriste `xfbjgxtgvlyndonhlupm`. Izolovani SQL testovi rade u memoriji bez Dockera. Istorija starijih SQL Editor primena nije CLI istorija migracija: pregledati šemu pre ponavljanja migracija.

Sintetički vlasnik služi samo za proveru testnog interfejsa. Pravi produkcioni vlasnik dobija ovlašćenje posle stvarne potvrde mejla u fazi 12. U aplikaciji se koristi publishable ključ; on ne daje ovlašćenje za migracije ili dodelu uloge. Git checkpoint vraća kod, a ne cloud podatke ili Auth podešavanja.

## Dokumentacija

- [Supabase SQL i pristup](supabase/README.md)
- [Primenjene migracije i provere](supabase/DEPLOYMENT.md)
- [Raspored i stanje faze 5](supabase/SCHEDULE.md)
- [Dostupnost i ugovor za fazu 7](supabase/AVAILABILITY.md)
- [Aktuelni plan i sledeći chat](../PHASE_PLAN.md)
- [Specifikacija aplikacije](../docs/PRD.md)
- [Potvrđene odluke](../docs/ODLUKE.md)

Sledeća celina je faza 7: atomske rezervacije, zaštita pristupa, idempotencija i stvarna konkurentnost. Domen i potvrda/slanje mejla namerno čekaju fazu 12.
