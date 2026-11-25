# Vule Still

**Aktuelno, 25.11.2026 — UI korak 1:** Premium ponuda je privremeno povučena na Vule-still-test kroz postojeće `services.is_active`. Nova zakazivanja nude četiri standardne usluge; svih sedam kataloških redova i istorija ostaju sačuvani. Stari premium linkovi/nacrti vraćaju na dostupne opcije uz objašnjenje. Zahtev nepoznatog ishoda i dalje se proverava istim ključem. Prazne grupe se ne prikazuju. Lokalni pregled ovog koraka: **http://127.0.0.1:3100** (`npm.cmd run dev:test`); port 3000 trenutno koristi druga aplikacija. Više usluga po dolasku ostaje za korake 2 i 3 [UI plana](../docs/PLAN-UI-I-VISE-USLUGA.md).

**Aktuelno, 14.11.2026:** Klijenti ulaze telefonom ili mejlom bez lozinke/kodova. Primenjena su nova trajanja četiri usluge i nove rezervacije samo za Neuzin; Zrenjanin ostaje za kasnije. Detalji, Supabase Auth opcija potrebna za pokretanje i granice sesije gosta: [potvrđene izmene](../docs/IZMENE-2026-11-14.md). Ovaj dodatak ima prednost nad istorijskim opisom test prijave ispod. `npm.cmd run dev` pokreće test aplikaciju na http://127.0.0.1:3000; `npm.cmd run dev:test` koristi port 3100. Administracija je na `/administrator`.

Next.js + TypeScript aplikacija sa Supabase bazom. Faze 1–6 su završene za testni obim, a faze 7–10 su spremne za korisnički pregled: atomske rezervacije, kompletan korisnički tok, Moji termini/obaveštenja i zasebna administracija. Faza 10 ima direktan ulaz, svoje zaglavlje/navigaciju i urednik uobičajene nedelje. Završne provere: **15/15 Google Chrome, 122 izolovane SQL, 23 lokalne, build i lint**, uz nove stvarne template integracione provere. Raniji dokazi su sačuvani. Korisničko prihvatanje nije evidentirano. Razvoj koristi samo Vule-still-test; nema produkcione objave. Prijava telefonom i lozinkom ostaje za poseban završni blok pre produkcije; sada je aktivan postojeći testni imejl + lozinka bez potvrde.

## Lokalno pokretanje

```powershell
npm.cmd ci
npm.cmd run dev:test
```

Za razvoj podesiti ignorisani `.env.test.local`: Supabase URL `https://xfbjgxtgvlyndonhlupm.supabase.co`, njegov publishable ključ, `VULE_AUTH_MODE=password-test` i `VULE_PHASE3_ACCESS=1`. Koristiti imena promenljivih iz `.env.example`; stvarne ključeve ne unositi u Git. U ovom radnom folderu test konfiguracija već postoji. Skripte `dev:test`, `build:test` i `start:test` proveravaju identitet test projekta pre pokretanja. Postojeći `.env.local` je namenjen budućoj produkciji i nije razvojno okruženje za sintetičke upise.

Adresa test aplikacije: http://127.0.0.1:3100. **Direktan administratorski ulaz: http://127.0.0.1:3100/administrator**. Dovoljan je jedan server na portu 3100; stari port 3000 nije potreban. Rezervacija: `/rezervacija`, lični termini: `/moji-termini`, vlasnički pregled posle prijave: `/administracija`, dva kalendara: `/raspored`, uobičajena nedelja: `/administrator/sablon`. Administratorski link nije u javnoj navigaciji, a poseban link ne daje pravo pristupa. Nove testne naloge možeš napraviti kroz javnu testnu prijavu; vlasničko članstvo se dodeljuje posebno, nikad samostalnom registracijom. Za proveru koristiti Google Chrome. [Kratko vlasničko uputstvo](../docs/ADMINISTRACIJA.md).

## Provere

```powershell
npm.cmd run build:test
npm.cmd run lint
npm.cmd run test:auth
npm.cmd run test:availability
npm.cmd run test:booking
node --env-file=.env.test.local scripts/check-supabase.mjs
npm.cmd --prefix .\supabase\tests ci --ignore-scripts --no-audit --no-fund
npm.cmd --prefix .\supabase\tests test
```

`check:supabase` proverava stvarni javni API i zabranu anonimnog pristupa privatnim podacima. Izvršava samo čitanje: ne pravi naloge, ne šalje mejlove i ne upisuje podatke.

`build:test` koristi `.next-phase7-build`, odvojeno od razvojnog `.next-test`. Posle izgradnje `npm.cmd run start:test` prikazuje gotov build na portu 3100; ne pokretati ga dok razvojni server koristi isti port. `test:auth` ne proverava dostavu mejla. `node --env-file=.env.test.local scripts/check-availability-live.mjs` čita cloud RPC i lokalni API dok testni server radi.

Za proveru kalendara potreban je instaliran Google Chrome, pokrenut testni server, pa `npm.cmd run test:browser`. Konfiguracija izričito koristi kanal `chrome`. Test koristi postojeći sintetički vlasnički nalog iz ignorisanog `.env.phase6-state.local` JSON fajla. Njegova struktura je `{ "owner": { "email": "vule-phase6-owner-<oznaka>@example.invalid", "password": "<lokalna testna lozinka>" }, "customer": { "email": "vule-phase6-customer-<oznaka>@example.invalid", "password": "<druga lokalna testna lozinka>" } }`; naloge i članstvo treba kontrolisano pripremiti na test projektu, ne izmišljati produkcione korisnike. Browser test menja/objavljuje jednu testnu smenu i vraća je. `check-schedule-owner-live.mjs` koristi iste naloge, proverava konkurentne revizije i objavljuje tekuću testnu nedelju.

SQL testovi koriste novu PGlite bazu u memoriji, odvojenu od cloud podataka, bez Dockera. Auth objekti u tom testu su zamene, pa stvarni OTP i autentifikovani API tokovi zahtevaju posebne integracione provere.

Završni paket ima 15 testova: registracija/navigacija, javni i prijavljeni korisnički tok, zaseban administratorski ulaz/navigacija, bezbedno pomeranje na drugi datum sa trajnim obaveštenjima, šablon/nedelja, vlasnički tok i kalendari. Kreira dva sintetička korisnička naloga po zajedničkom paketu, otkazuje sopstvene označene rezervacije i vraća testni raspored/šablon; istorija/revizije ostaju. Tačni rezultati i granice su u [SQL/browser rezultatima](supabase/tests/RESULTS.md). Stvarne paralelne API provere iz prethodnog nastavka ne treba izjednačavati sa izolovanim SQL testovima.

## Kratko korišćenje na testu

1. Klijent bira lokaciju, jednu uslugu, datum/vreme i pregled. Prijava i potpun profil potrebni su za potvrdu. Sačuvan izbor ne zauzima termin. Ako odgovor nestane, koristiti „Proveri isti zahtev“ pre nove rezervacije.
2. U „Moji termini“ proveriti potvrdu, obaveštenja i detalje. Redovno otkazivanje traži potvrdu i dostupno je najmanje 30 minuta pre početka. Obaveštenja se vide u aplikaciji; nema booking mejlova/podsetnika.
3. Vlasnik ulazi preko `/administrator`, pa u „Rezervacije“ bira datum, dnevni/sedmodnevni prikaz, lokaciju i status; „Dodaj ručni termin“ zahteva samo ime. Telefon je opcion. Gost nema nalog niti obaveštenje u aplikaciji, a bez telefona nema ni kontakta za poziv.
4. „Izmeni termin“ menja osobu, vreme/lokaciju i kontakt gosta, uz sačuvano trajanje/uslugu. Za novu uslugu otkazati stari i napraviti novi termin. Za izmenu/otkazivanje važi rok 30 minuta; nema izuzetka za kasno otkazivanje. Neuspešna izmena čuva prethodni termin.
5. U `/raspored` čuvanje nacrta ne menja javnu ponudu. Objaviti tek pregledan raspored obe lokacije. Ako objava ugrožava rezervaciju, odbija se bez otkazivanja; rešiti je pojedinačno dozvoljenom radnjom, pa ponoviti objavu. Ako se promenila revizija ili ishod mreže nije poznat, prvo osvežiti stanje.
6. Za rad nedeljom dodati smenu pomoću `+` u koloni „Ned“. Za potpuno neradan dan ukloniti sve njegove smene na obe lokacije. Smene otvaraju radno vreme; nisu rezervacije klijentima.
7. „Uobičajena nedelja“ menja šablon za novopripremljene nedelje, sa pauzama i razmakom. **Postojeći nacrti i objavljene nedelje ne prepisuju se**; menjaju se pojedinačno u „Radno vreme“.

Faza 11 (izuzetna kasna otkazivanja, grupne promene, blokiranje, usluge i audit ekran) ostaje odložena. Telefon + lozinka, stvarni vlasnik/oporavak, produkciona konfiguracija, domen/hosting i operativna predaja nisu završeni ovim testnim kandidatom.

## Struktura

- `src/lib/supabase/client.ts`: browser klijent sa publishable ključem.
- `src/lib/supabase/server.ts`: klijent vezan za cookies tekućeg zahteva.
- `src/lib/supabase/proxy.ts` i `src/proxy.ts`: provera/osvežavanje tokena i prosleđivanje cookies/cache zaglavlja; ne predstavljaju potpunu autorizaciju niti pravilo 30 dana.
- `src/types/database.ts`: tipovi generisani iz stvarnog projekta.
- `supabase/migrations/`: SQL izvori; planirani lokalni nazivi i stvarne cloud verzije mapirani su u [DEPLOYMENT.md](supabase/DEPLOYMENT.md). Ne ponavljati primenjene migracije.
- `src/lib/availability.ts` i `src/app/api/availability/route.ts`: vremenska pravila i javni API bez upisa rezervacija.
- [src/app/(public)/](src/app/(public)/): javne/klijentske stranice sa javnim zaglavljem; URL-ovi su ostali isti.
- [src/app/(owner)/](src/app/(owner)/): zasebno zaglavlje, ulaz, rezervacije, dva kalendara i šablon; svaka stranica/RPC zasebno proverava pristup.
- `supabase/scripts/bootstrap_admin.sql`: dodela admina tek posle verifikacije dogovorenog naloga.
- `public/fonts/`: lokalni Manrope font i njegova licenca.

## Trenutni obim

Baza test projekta sadrži aktivnost/sesije, nacrte/objavljene nedelje, pune rezervacije, obaveštenja, audit i ključeve ponavljanja. Katalog sadrži Zrenjanin, Neuzin, jednog frizera i sedam usluga. Direktni browser upisi nisu dozvoljeni: kontrolisani RPC-ovi proveravaju sesiju, vlasništvo/ulogu, vreme, dostupnost i integritet. Dostupnost ne predstavlja potvrdu termina.

Projekat `usokysukvtgtvrtxnjai` ostaje buduća produkcija. Sve aktuelne sintetičke Auth/API provere koriste `xfbjgxtgvlyndonhlupm`. Izolovani SQL testovi rade u memoriji bez Dockera. Istorija starijih SQL Editor primena nije CLI istorija migracija: pregledati šemu pre ponavljanja migracija.

Sintetički vlasnik služi samo za proveru testnog interfejsa. Pravi produkcioni vlasnik dobija ovlašćenje posle stvarne potvrde mejla u fazi 12. U aplikaciji se koristi publishable ključ; on ne daje ovlašćenje za migracije ili dodelu uloge. Git checkpoint vraća kod, a ne cloud podatke ili Auth podešavanja.

## Dokumentacija

- [Supabase SQL i pristup](supabase/README.md)
- [Primenjene migracije i provere](supabase/DEPLOYMENT.md)
- [Raspored i stanje faze 5](supabase/SCHEDULE.md)
- [Dostupnost i ugovor za fazu 7](supabase/AVAILABILITY.md)
- [Aktuelni plan i sledeći chat](../PHASE_PLAN.md)
- [Kratko uputstvo za administraciju](../docs/ADMINISTRACIJA.md)
- [Specifikacija aplikacije](../docs/PRD.md)
- [Potvrđene odluke](../docs/ODLUKE.md)

Sledeći korak je korisnički pregled faza 8/9/10 i eventualne potvrđene popravke. Završni Auth telefonom i lozinkom i produkciona aktivacija rade se zasebno, bez prenosa sintetičkih naloga/podataka. Izmene su nekomitovane na `phase/07-booking`; nema push-a ili objave.
