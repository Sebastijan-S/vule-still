# Vule Still — SoW i plan realizacije

Verzija 1.0 • 31.10.2026. • Predlog obima rada i tehničke realizacije za pregled.

Ovaj dokument definiše isporuke za [PRD](PRD.md), prema [43 odgovora](ODLUKE.md). Poslovna pravila su usaglašena; hosting provajder i detalji tehničke izvedbe predstavljaju predlog. Nisu ugovoreni novčana naknada za izradu, kalendarski rok ili održavanje nakon isporuke.

## 1. Isporuke

1. Novi, samostalan Next.js + TypeScript projekat sa jasnim uputstvom za pokretanje.
2. Supabase SQL migracije, početni podaci, pravila pristupa i transakcije za rezervacije/raspored.
3. Prijava i registracija imejl kodom, profil i pravilo 30 dana neaktivnosti na nivou naloga.
4. Mobilni i desktop interfejs koji prati postojeći vizuelni pravac.
5. Javni tok rezervacije, Moji termini i trajna obaveštenja unutar aplikacije.
6. Administratorski kalendar, ručni unos i izmene, objavljivanje rasporeda, blokade, usluge i zabrane naloga.
7. Provere ključnih poslovnih pravila, pristupa podacima i kompletnog korisničkog toka.
8. Pripremljena konfiguracija hostinga, uputstvo za domen/SMTP i produkciono puštanje nakon pregleda.
9. Uputstvo vlasniku za nedeljni raspored, vanredne promene, limite servisa, rezervne kopije i oporavak.

Stari izvorni kod se ne prenosi kao osnova nove aplikacije. Ponovo se koriste samo odabrani vizuelni resursi i potvrđeni sadržaj. Ne migriraju se stari korisnici ni rezervacije.

## 2. Predlog arhitekture

| Deo | Predlog | Namena |
| --- | --- | --- |
| Aplikacija | Next.js App Router + TypeScript | Javne stranice, korisnički nalog, administracija, serverske operacije |
| Prikaz | React, CSS/Tailwind po potrebi | Dosledne komponente i mobilni raspored |
| Baza | Supabase PostgreSQL | Trajno čuvanje i transakcije |
| Identitet | Supabase Auth + podržana SSR integracija | Prijava kodom i proverene sesije |
| Pristup | RLS i usko definisane serverske/SQL funkcije | Korisnik vidi samo svoje podatke, vlasnik ima odgovarajuća ovlašćenja |
| Kod | Novi GitHub repozitorijum | Verzije, pregled i istorija izmena |
| Hosting | Netlify Free | Kandidat za komercijalni hosting bez pretplate |
| Slanje koda | Resend Free povezan kao SMTP u Supabase Auth | Isključivo imejlovi za prijavu |
| Resursi | Lokalni optimizovani logo i hero u novom projektu | Bez zavisnosti od stare aplikacije |

Verzije Next.js-a, Node-a, Supabase biblioteka i hosting adaptera biraćemo pri inicijalizaciji prema tada podržanoj kombinaciji i zaključati u lockfile-u. Ne koristiti verzije iz starog startera kao automatski izbor.

Next.js na Netlify-u podržava App Router i serverske funkcionalnosti kroz njihov adapter; aplikacija i dalje koristi Next.js. [Netlify dokumentacija](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)

Supabase za Next.js dokumentuje posebne klijente za pregledač i server i obradu sesija. Koristiti taj tok, uz stvarnu serversku proveru identiteta. [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)

## 3. Model podataka

Ovo je početni logički model. Konačne kolone i indeksi nastaju u fazi baze.

| Entitet | Ključna uloga |
| --- | --- |
| auth.users | Identitet kojim upravlja Supabase Auth |
| profiles | Ime, prezime, telefon i stanje zabrane, vezano za user ID |
| admin_memberships | Ovlašćeni vlasnik; nema samostalnog upisa korisnika u ovu tabelu |
| account_activity / session_access | Aktivnost naloga i opoziv pristupa posle neaktivnosti |
| locations | Zrenjanin i Neuzin, javni podaci i aktivnost |
| staff | Jedan frizer kao zajednički resurs |
| services | Zajednička ponuda, trajanje, kategorija, redosled i aktivnost |
| weekly_templates | Početni ponavljajući raspored za pripremu nedelja |
| schedule_weeks / schedule_revisions | Nacrti i objavljene verzije konkretnih nedelja |
| shifts / blocks | Konkretne smene sa lokacijom, pauze, odsustva i neradni periodi |
| scheduling_settings | Razmak između lokacija, početno 60 minuta, sa kontrolom izmene |
| bookings | Nalog ili ručni gost, ime osobe, lokacija, frizer, vreme, snimak usluge/trajanja, status, verzija |
| notifications | Trajna obaveštenja za povezani nalog, sadržaj promene i vreme čitanja |
| audit_events | Ko je napravio/izmenio/otkazao rezervaciju ili raspored, kada i iz kog razloga |
| mutation_keys | Zaštita od duplih operacija pri ponovljenim zahtevima |

Vremena rezervacija čuvati kao apsolutne trenutke; datume smena i granice nedelja izvoditi u Europe/Belgrade. Ne hardkodirati stalni UTC pomak. Podaci profila ne smeju da se kopiraju u javni prikaz dostupnosti.

Za ručnog gosta `user_id` je prazan; ime je obavezno. Kontakt, ako je unet, vidljiv je samo vlasniku. Ne povezivati goste sa nalogom po imenu.

## 4. Transakcije i prava pristupa

Predlog je da kritične mutacije idu kroz mali skup kontrolisanih operacija: potvrda rezervacije, otkazivanje, administratorska izmena, objavljivanje rasporeda, promena razmaka i blokiranje naloga. Svaka proverava važeći identitet i prava, pa uslove iz PRD-a. Direktan upis koji zaobilazi pravila ne sme biti dostupan običnom klijentu.

Za potvrđene rezervacije predvideti PostgreSQL zabranu preklapanja intervala istog frizera; dodati proveru naloga i lokacije. PostgreSQL range tipovi i exclusion constraints podržavaju ovakvo ograničenje. [PostgreSQL dokumentacija](https://www.postgresql.org/docs/17/rangetypes.html)

Rezervacija, promena rasporeda i blokiranje moraju koristiti usklađeno zaključavanje. Zabrana preklapanja sama ne štiti od istovremene promene smene, pauze ili putovanja. Pri očekivanom malom obimu može se serijalizovati izmena rasporeda/rezervacija za zajedničkog frizera. Transakcija uključuje obaveštenje i audit događaj, tako da ne može ostati polovična promena.

Pregled pogođenih rezervacija nosi verziju rasporeda/skupa. Ako se stanje promenilo do potvrde, operacija se prekida i traži osvežen pregled; ne otkazuje automatski dodatne termine koji nisu bili prikazani.

RLS pokriva profile, rezervacije, obaveštenja i privatne podatke. Javna funkcija dostupnosti vraća samo slobodne početke i javne podatke. Tajni serverski ključ nikada ne ide u pregledač. Ako neka serverska operacija ima povišena prava, ona mora eksplicitno sprovesti sve provere koje ta prava zaobilaze. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 5. Prijava i globalna neaktivnost

Supabase Auth šalje kod preko povezanog SMTP-a i proverava ga. Ugrađeni demonstracioni SMTP nije namenjen javnoj aplikaciji i ograničava primaoce na članove tima, pa je povezivanje stvarnog SMTP servisa obavezno za lansiranje. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

Predlog konfiguracije je rok koda 10 minuta i ponovno slanje posle najmanje 60 sekundi, uz serverska ograničenja pokušaja/slanja i zaštitu od automatizovanog trošenja kvote. Pogrešan kod i potrošen limit daju razumljivu poruku, a ne pristup nalogu. Promena email šablona na kod mora se proveriti stvarnim prijavljivanjem. [Supabase prijava bez lozinke](https://supabase.com/docs/guides/auth/auth-email-passwordless)

Zahtev korisnika je 30 dana neaktivnosti celog naloga, a ne poseban rok po uređaju. Supabase ugrađena ograničenja životnog veka sesija dostupna su na Pro planu i više; ne oslanjati se na njih kao na besplatnu, već završenu funkciju. [Supabase sesije](https://supabase.com/docs/guides/auth/sessions)

Projektni predlog: dodati serverski i bazni uslov pristupa vezan za poslednju stvarnu aktivnost naloga i reviziju pristupa sesija. Pre obnavljanja aktivnosti proveriti da li je istekao rok. Posle isteka stari tokeni ne smeju ponovo oživeti samo zato što je korisnik jednom ponovo prijavljen na drugom uređaju. Nova autentifikacija uspostavlja nov dozvoljeni pristup; ostale stare sesije zahtevaju kod. Dok nalog nije istekao, aktivnost jednog uređaja održava i ostale postojeće sesije.

Ovaj deo se prvo dokazuje na malom funkcionalnom primeru sa dva uređaja i direktnim pristupom baznom API-ju, pre ostatka korisničkog interfejsa. Ako se pokaže da predloženi način ne daje traženu zaštitu, arhitektura se koriguje bez tihog ublažavanja poslovnog pravila.

## 6. Faze realizacije i uslovi završetka

| Faza | Posao i isporuka | Uslov završetka / zavisnost |
| --- | --- | --- |
| F0 — Specifikacija | PRD, SoW, odluke i predložena tumačenja | Dokumenti pregledani; eventualne korekcije unesene |
| F1 — Novi temelj i Supabase | Novi Next.js projekat, okruženja, migracije, seed lokacija/usluga, RLS, vlasnička uloga | Baza se reprodukuje migracijama; privatne tabele nisu javno dostupne; potrebni Supabase projekat i imejl vlasnika |
| F2 — Prijava/registracija | SMTP, kod, profil, sesija, čuvanje izbora, odjava, globalna neaktivnost | Prava prijava radi i za adresu van razvojnog tima; A01–A02, A09 i A16; potreban verifikovan domen za slanje |
| F3 — Dizajn i javni ekran | Vizuelne komponente, početna, lokacije, ponuda, mobilni tok | Pregledan mobilni/desktop prototip; veze i koraci jasni; generički kontakti označeni |
| F4 — Raspored i rezervacije | Objavljene smene, dostupnost, rokovi, transakcija potvrde, otkazivanje, Moji termini | A03–A08, A10, A14 i A19; istovremeni zahtevi ne stvaraju konflikte |
| F5 — Administracija | Uređivač/objava nedelje, pauze, odsustva, putovanje, ručni unos/izmena, korisničke zabrane | A11–A15; provere sukoba pri objavi i izmenama |
| F6 — Obaveštenja i završna integracija | Obaveštenja u aplikaciji, greške, prazna stanja, pristupačnost, optimizacija resursa | A17–A18 i A20; nijedna rezervacija ne pokreće imejl |
| F7 — Provera i predaja | Kompletni tokovi, odvojen preview, hosting/domen, rezervna kopija i uputstva | Svi kriterijumi prolaze, poznati nedostaci evidentirani, javni podaci provereni; objava kao zaseban korak |

Model rasporeda i minimalne serverske funkcije pripremaju se u F1/F4; interfejs njihovog administriranja dolazi u F5. Time se izbegava da rezervisanje zavisi od ručno izmišljenih slobodnih termina u interfejsu.

Predložena nova struktura je `vule-still/` pored `docs/`, `outputs/` i `work/`. Stari arhivski paketi, runtime alati i privremene skripte ne ulaze u novi repozitorijum. Tačne komande pokretanja i testiranja dokumentuju se nakon izbora verzija.

Rok se određuje nakon povezivanja naloga i dogovora o datumu isporuke; trenutno nema potvrđenog datuma. Provere SMTP domena i pristup servisima predstavljaju spoljne zavisnosti, a ne završene aktivnosti.

## 7. Plan provere

| Oblast | Provera |
| --- | --- |
| Pravila vremena | Primeri iz PRD-a, 15/30-minutne granice, danas + 14, prošlost, oba prelaska letnjeg/zimskog vremena |
| Rezervacije | Paralelni isti/preklapajući termini, dupli zahtev, ponovljena potvrda nakon prekida mreže |
| Raspored | Nacrt/objava, neradan dan, blokada, putovanje, paralelna rezervacija tokom izmene, početak tekuće nedelje |
| Nalozi | OTP, dopuna profila, čuvanje izbora, odjava, dva uređaja, 30 dana ukupne neaktivnosti |
| Ovlašćenja | Tuđi ID rezervacije, direktan pristup API-ju, samododela vlasničke uloge, pokušaj zaobilaženja zabrane |
| Administracija | Gost samo sa imenom, neuspešna izmena čuva stari termin, otkazivanje uz razlog, masovni uticaj promene |
| Obaveštenja | Nastaju zajedno sa promenom, vidljiva samo primaocu, ostaju posle osvežavanja; nema booking imejlova |
| Interfejs | 360/390/1280 px, tastatura, čitljivost, velike akcije, loading/error/empty stanja |
| Produkcija | Ispravan domen, autentifikacija na stvarnom URL-u, izgrađena aplikacija, monitoring kvota i proba oporavka |

Za kritične transakcije koristiti stvarnu testnu PostgreSQL bazu, uz reprodukovane paralelne zahteve. Testiranje ne sme da pravi rezervacije stvarnim klijentima. Rezultate zapisati uz isporuku; dokumentacija trenutno opisuje plan, ne rezultate izvršenih testova.

## 8. Troškovi i ograničenja

Provereno 31.10.2026. Planovi provajdera mogu se promeniti i proveravaju se ponovo pri aktivaciji.

| Stavka | Predlog troška | Ograničenje / posledica |
| --- | --- | --- |
| Domen | Kupovina i obnova, cena zavisi od izabranog domena | Nije izabran niti kupljen |
| Netlify Free | 0 mesečne pretplate | 300 kredita mesečno; pri iscrpljenju projekta dolazi do pauziranja |
| Supabase Free | 0 mesečne pretplate | Ograničenja resursa, mogućnost pauziranja nakon nedovoljne aktivnosti |
| Resend Free | 0 mesečne pretplate | Do 100 poruka dnevno i 3.000 mesečno; koristi se samo za prijavu |
| Izrada/održavanje | Nije ugovoreno ovim dokumentom | Ne izjednačavati besplatne servise sa cenom izrade ili podrške |

Netlify eksplicitno navodi komercijalne projekte kao dozvoljene na Free planu. Aktuelni model za nove naloge koristi kredite: produkciona objava 15, propusni opseg 20/GB, web zahtevi 2/10.000 i compute 10/GB-h. Pošto i objave troše kvotu, razvoj treba pretežno da koristi lokalni rad i preview, uz praćenje ukupnog saobraćaja. [Komercijalna upotreba](https://www.netlify.com/blog/introducing-netlify-free-plan/), [aktuelni cenovnik](https://www.netlify.com/pricing/)

Free kvota nije garancija neprekidnog rada. Netlify Free pauzira projekat kada se krediti potroše; neće se automatski preći na plaćeni paket. Procena dovoljnosti zavisi i od broja poseta, veličine slika, upita i objava, a ne samo od 11–20 rezervacija dnevno. [Netlify limiti](https://www.netlify.com/pricing/pro-vs-free/)

Supabase Free trenutno uključuje bazu od 500 MB, 50.000 mesečno aktivnih korisnika i 5 GB egress-a. Free projekti mogu biti pauzirani nakon nedelju dana slabe aktivnosti; plaćene dnevne rezervne kopije ne treba predstavljati kao uključenu Free funkciju. U isporuku ulazi postupak sopstvenog izvoza i vraćanja podataka. [Supabase cenovnik](https://supabase.com/pricing), [pauziranje](https://supabase.com/docs/guides/platform/free-project-pausing)

Resend Free ograničenja 100/dan i 3.000/mesec računaju se odvojeno. Primer procene: 20 novih prijava dnevno tokom 30 dana je približno 600 poruka, pre ponovnih slanja i ostalih prijava. To je scenario, ne prognoza stvarne potrošnje. Ako se kvota potroši, postojeće validne sesije mogu nastaviti rad, ali nova prijava zavisi od ponovnog dostupnog slanja; ne postoji prijava bez provere kao rezervno rešenje. [Resend cenovnik](https://resend.com/pricing)

## 9. Potrebni podaci i odgovornosti

Vlasnik projekta određuje vlasništvo naloga i dostavlja stvarne kontakte, administrativni imejl i izbor domena. Povezivanje zahteva pristup Supabase-u, repozitorijumu, hostingu, DNS-u i SMTP servisu. Tajne se unose u odgovarajuća podešavanja; ne šalju se u javnoj dokumentaciji.

Izrada obuhvata konfiguraciona uputstva i tehničko povezivanje za koje postoji pristup. Kupovina domena ili plaćenih paketa predstavlja posebnu radnju. Ne obećava se besplatna usluga bez ograničenja niti automatsko plaćanje prekoračenja.

Pred javno korišćenje vlasnik mora da ima stvaran način kontakta i operativni postupak za hitna otkazivanja, jer nema spoljne dostave obaveštenja. Kod ručne rezervacije samo sa imenom možda neće postojati ni kontakt za poziv; interfejs to jasno pokazuje.

## 10. Predaja i promene obima

Završena prva verzija znači da su isporučeni kod, migracije, konfiguracioni primeri bez tajni, uputstva i rezultati provera A01–A20. Ne smeju ostati poznati kvarovi koji dozvoljavaju duplu rezervaciju, pristup tuđim podacima ili neovlašćenu administraciju.

Dodavanje više frizera, kombinovanih usluga, naplate, SMS/push poruka, podsetnika, korisničkog pomeranja, automatskog povezivanja ručnih gostiju ili migracije podataka smatra se promenom obima i prvo se upisuje u PRD/SoW sa uticajem na realizaciju i troškove.

Posle javne aktivacije vlasnik vodi nedeljno objavljivanje rasporeda, prati kvote i primenjuje postupak rezervnih kopija. Dugoročna podrška i eventualni automatizovani backup servis određuju se zasebno.
