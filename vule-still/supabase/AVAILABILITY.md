# UI korak 2 — više usluga, 25.11.2026.

Ova dopuna ima prednost nad opisom jedne usluge ispod. Dostupnost i potvrda koriste zbir stvarnih kataloških trajanja. Sve stavke moraju stati u isti slobodan period; roditeljski interval ostaje jedina zauzetost frizera.

- Dostupnost: `GET /api/availability?date=YYYY-MM-DD&location=<uuid>&services=<uuid-1>&services=<uuid-2>`. Ključ `services` se ponavlja. Raniji `service=<uuid>` ostaje podržan; mešanje formata i duplikati se odbijaju. Novi RPC je `services_availability_context(date,uuid,uuid[])`. Odgovor dodaje `items` u redosledu kataloga i ukupni `duration_minutes`; postojeći vremenski mehanizam koristi taj zbir.
- Javna potvrda koristi postojeći `POST /api/reservations`. Novi oblik zamenjuje `service` i `expected_service_name` sa `services: string[]` i `expected_items: { service_id, service_name, duration_minutes }[]`; `expected_duration` je zbir, a postojeći `request_key`, `location`, `start`, `schedule_revision` i opcioni `attendee_name` ostaju. Novi RPC: `confirm_services_reservation`. SQL sam čita aktivnost/nazive/trajanja, poredi pregled svake stavke i ukupno trajanje, pa atomskom transakcijom upisuje roditelja, stavke, audit, obaveštenje i ključ.
- Vlasnički unos: isti novi izbor u `POST /api/owner/reservations` uz `operation: "create"`, `name` i opcioni `phone`; novi RPC `owner_create_services_reservation`. Izmena/otkazivanje i raniji pojedinačni oblik ostaju isti.
- Duplikati ID-jeva, prazan izbor, neaktivna stavka, drugačiji naziv/trajanje, neispravan pregled ili prekratak period odbijaju se bez delimičnog upisa. Isti ključ pokriva ceo izbor i jedan dolazak. Redosled klikova ne menja ključ: identitet se normalizuje po ID-ju, a prikazani redosled pamti se po katalogu. Pošto je prvo proveren sačuvani ključ, povučena/preimenovana stavka ne blokira razrešenje već uspešnog zahteva.
- Odgovori za rezervaciju, „Moje termine“, vlasnički pregled i obaveštenja sadrže sačuvane `items`. Pomeranje koristi prvobitni zbir; otkazivanje oslobađa ceo interval. Sastav potvrđenog dolaska se ne menja. Stari trajni rezultati ključeva mogu nemati `items`, pa prikazi zadržavaju sačuvan sažetak i zbir kao kompatibilan prikaz.

Korak 3 povezuje javni i vlasnički višestruki izbor sa ovim ugovorom. Prikaz sabira trajanja za pregled; ponuđene početke i kraj vraća postojeći mehanizam dostupnosti na osnovu SQL podataka. Izmena izbora ponovo učitava dostupnost i zadržava početak samo ako pripada novom rezultatu. Javni pregled šalje `services`, snimak svake stavke i zbir. Pending zahtev se ponavlja pre provere današnjeg kataloga/dostupnosti, u originalnom scalar ili array obliku sa istim ključem. Pri vraćanju UI-ja zadržati aditivnu šemu i sve podatke; ne svoditi raniji kombinovani dolazak na prvu uslugu niti brisati stavke.

---

# Dostupnost — faza 6

Aktuelno stanje faza 7–10: konfliktna objava se odbija bez automatskog otkazivanja. Booking migracija je **već primenjena** na Vule-still-test i koristi isti red frizera za potvrdu i objavu, uz nezavisno range-exclusion ograničenje protiv preklapanja. Javno zauzeće sadrži i `travel_gap_minutes`, bez identiteta ili kontakta. Dostupnost ostaje savetodavna; konačna transakcija proverava sva pravila. Stvarne paralelne provere su prošle u prethodnom nastavku, a završni customer/owner Chrome paket sada prolazi 12/12. Ne ponavljati migraciju; videti [stvarnu istoriju](DEPLOYMENT.md) i [rezultate](tests/RESULTS.md).

## Ugovor

`GET /api/availability?date=YYYY-MM-DD&location=<UUID>&service=<UUID>` radi bez prijave i vraća `Cache-Control: no-store`. Nevažeći parametri vraćaju 400; privremeno nedostupna baza ili nepostojeća lokalna granica smene vraćaju 503 sa porukom na srpskom. Nema upisa rezervacije.

Izvor je `availability_context(date,uuid,uuid)`: serversko vreme, trajanje aktivne usluge, objavljeni raspored/revizija i zauzeti intervali jednog zajedničkog frizera sa obe lokacije. Javni rezultat sadrži vreme i razlog dostupnosti, bez identiteta, imena, telefona i ID-jeva rezervacija. Privatna tabela `reservations` sadrži pune rezervacije; korisnik pod RLS-om čita samo svoje, vlasnik koristi kontrolisani pregled, a direktni browser upisi nisu dozvoljeni. Otkazane rezervacije ne ulaze u zauzeće.

`src/lib/availability.ts` računa dostupnost iz tih činjenica. Klijent ne može zadati trajanje, zauzeće ili merodavno vreme. Datum je od današnjeg datuma u Srbiji do danas + 14 uključivo; početak je najmanje 15 minuta u budućnosti. Ceo termin mora stati u slobodan period. Korak je trajanje usluge od početka svakog slobodnog perioda; vremenski rok filtrira niz, ne pomera njegov početak. Intervali su poluotvoreni, pa je dodirivanje dozvoljeno. Zauzeće druge lokacije proširuje se za objavljeni razmak putovanja.

Razlozi su `available`, `unpublished`, `closed`, `fully_booked`, `insufficient_duration`, `cutoff`, `outside_horizon`, `inactive_location`, `inactive_service`. Interni `invalid_schedule` daje 503 bez nuđenja nesigurnih termina.

Koristi se `Europe/Belgrade`, bez fiksnog UTC pomaka. DST preskočene lokalne granice se odbijaju. Kod ponovljenog sata početak smene koristi prvo, kraj poslednje pojavljivanje; oba stvarna termina imaju različit ISO trenutak i `utc_offset_minutes`. Trajanje je proteklo vreme. Budući korisnički interfejs mora jasno razlikovati ponovljeni sat.

## Provereni primeri

| Objavljeni rad/slobodan period | Usluga | Rezultat |
| --- | --- | --- |
| Zrenjanin 10–15, bez prekida | 20 min | 15 početaka, 10:00…14:40 |
| Zrenjanin 10–15, bez prekida | 40 min | 7 početaka, 10:00…14:00 |
| Neuzin 17–20, bez prekida | 40 min | 17:00, 17:40, 18:20, 19:00 |
| Zrenjanin, zauzeto/pauza 10:40–11:00 | 40 min | 10:00, pa 11:00, 11:40…14:20 |
| Danas 10:10, rad 10–15 | 20 min | Prvi dozvoljeni početak 10:40 |

`npm.cmd run test:availability`: 14 grupa provera, uključujući PRD primere, granice, pauze, uniju zauzeća, putovanje preko ponoći, DST i drugu vremensku zonu uređaja. `npm.cmd --prefix supabase/tests test`: 80 izolovanih SQL provera, od kojih 6 proverava kontekst dostupnosti i privatnost intervala. Auth u SQL testovima je fixture; stvarni API se proverava odvojeno.

`node --env-file=.env.test.local scripts/check-availability-live.mjs`: stvarni anonimni Supabase RPC i lokalni Next.js API za obe lokacije i obe dužine. Dana 3. 11. proveren je objavljeni 4. novembar: Zrenjanin 15/7, Neuzin 9/4 početaka za 20/40 min. Skripta samo čita i ne šalje mejl. Primeri sa zauzećem, ekstremnim vremenom i DST koriste izolovane fixtures; nisu unošeni stvarni termini klijenata.

## Istorijska kontrolna lista pre faze 7 — sada integrisano uz odbijanje konflikta

- Proširiti `reservations` vlasništvom/gostom, snimkom usluge/trajanja, idempotencijom i integritetom; tek zatim dodati kontrolisane atomske upise.
- Dostupnost je savetodavna. Konačna transakcija mora ponovo proveriti sva pravila pod istim zaključavanjem reda nedelje koje koristi objava rasporeda, uz vremenska pravila u bazi. Nije dovoljno verovati ranijem API rezultatu ili slati klijentsko trajanje.
- Pre rezervacionih upisa integrisati zaštitu objave rasporeda od konflikta sa postojećim rezervacijama. Potrebni su tačan pregled uticaja, eksplicitna potvrda i odbijanje zastarelog pregleda.
- Ponoviti stvarne konkurentne rezervacije na test projektu. Aktuelni konflikt odgovora pri čuvanju rasporeda može isteći; atomicitet revizije je proveren, ali HTTP poruku konflikta treba doraditi ako se menja RPC u fazi 7.

Git vraća izvorni kod, ne bazu. Migracije su aditivne i nemaju automatski `down`; pre oporavka baze zaustaviti pozivaoce i sačuvati izvoz. SQL Editor istorija mora se pregledati pre reprodukcije cloud migracija. Sintetički nalozi i lozinke se ne kopiraju u produkciju.
