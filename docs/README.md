# Vule Still — plan nove aplikacije

**Aktuelno 26.11.2026, koraci 5–6:** Završeni su početna/mobilna navigacija i oporavak kataloga/dostupnosti/booking unosa. Prošlo je **59 ciljanih Chrome provera na 3100 + 6 serverskih scenarija sa kontrolisanim kvarovima na privremenom 3101**, 30 lokalnih testova, lint, TypeScript i završni build. Postojeći termini i raspored su očuvani. Korisnik je izričito odobrio commit i push odmah po završetku koraka 6, uključujući sačuvane izmene koraka 5. Sledeći je korak 7. Server za pregled ostaje http://127.0.0.1:3100; detalji su u [RESULTS.md](../vule-still/supabase/tests/RESULTS.md). Raniji zapisi ispod ostaju istorijski.

**Aktuelno 26.11.2026:** Ceo korak 5 [UI plana](PLAN-UI-I-VISE-USLUGA.md) je lokalno spreman za pregled: uvod → usluge → Neuzin → kraća najava Zrenjanina, mobilne primarne akcije i pristupačan sekundarni meni. Zadržane su booking funkcionalnosti koraka 3–4. Prošlo je 46 ciljanih Chrome i 30 lokalnih testova, lint, TypeScript i završni build; detalji i granice dokaza su u [RESULTS.md](../vule-still/supabase/tests/RESULTS.md). Server ostaje na http://127.0.0.1:3100. Bez commit-a/push-a do odobrenja; koraci 6–8 nisu uključeni. Stariji statusi ispod su istorijski.

**Aktuelno 25.11.2026:** Korak 3 [UI plana](PLAN-UI-I-VISE-USLUGA.md) je spreman za pregled: javni i ručni unos više usluga, skraćeni tok za jednu lokaciju, čuvanje izbora i tačno ponavljanje pending zahteva. Važe nova kataloška trajanja i jedan dolazak sa zbirom svih različitih stavki. [Najnoviji rezultati](../vule-still/supabase/tests/RESULTS.md): 152 SQL, 30 lokalnih i 19 ciljanih Chrome provera. Istorijski opisi jedne usluge/ranijeg Auth toka ispod nisu aktuelna implementacija. Server: http://127.0.0.1:3100. Bez commit-a/push-a do korisničkog pregleda.

Osnovna specifikacija: 31.10.2026. Aktuelni skraćeni plan: 3.11.2026.

Najnovije odluke imaju prednost nad starijim opisima: cilj je proveren testni sajt u 2–3 radna dana od nastavka, uz pouzdan pristup servisima. Faze 8/9 rade se zajedno, administracija je jednostavna, a faza 11 je odložena. Bezbednost rezervacija i privatnost ostaju obavezne.

| Dokument | Sadržaj |
| --- | --- |
| [Aktuelni plan faza](../PHASE_PLAN.md) | Stvarno stanje, spojene isporuke, preostale provere i tekst za naredni chat |
| [PRD](PRD.md) | Funkcionalnosti, ekrani, pravila rezervisanja i kriterijumi prihvatanja |
| [SoW i plan realizacije](SOW.md) | Isporuke, faze, predlog arhitekture, troškovi, zavisnosti i provere |
| [Registar odluka](ODLUKE.md) | Svih 43 odgovora, razrešene promene i predložena tumačenja detalja |

## Dogovorena osnova

- Vule Still; izgled blizak dostavljenim screenshotovima, prvenstveno za telefon.
- Nova Next.js + TypeScript aplikacija, Supabase baza i Auth, početak sa praznom bazom.
- Jedan frizer, Zrenjanin i Neuzin; zajednička provera njegove zauzetosti.
- Jedna usluga po rezervaciji; standardne 20, premium 40 minuta.
- Nedeljni raspored postaje dostupan korisnicima tek kada ga vlasnik objavi.
- Razvojna prijava je imejl + lozinka bez potvrde mejla. Potvrda/oporavak čekaju završnu aktivaciju; obaveštenja o rezervacijama ostaju u aplikaciji, bez mejlova.
- Hosting bez mesečne pretplate koji dozvoljava komercijalnu upotrebu; domen se kupuje posebno.

## Predlog infrastrukture

GitHub za kod i Supabase za bazu/prijavu. Netlify i Resend su raniji kandidati za hosting i SMTP; tadašnje uslove i konfiguraciju treba proveriti pred aktivaciju. Trenutni razvoj koristi Vule-still-test, bez zavisnosti od domena/SMTP-a.

## Trenutno stanje i sledeći korak

Aplikacija je u [vule-still/](../vule-still/). Faze 1–6 završene su za testni obim; faza 7 je prošla stvarne paralelne provere. Customer faze 8/9 i jednostavna owner faza 10 sada su **spremne za korisnički pregled**: novi build/lint, 115 izolovanih SQL, 23 lokalne i ceo paket **12/12 Google Chrome** prolaze. Potvrđeno je vraćanje testnog rasporeda bez preostalih potvrđenih sintetičkih rezervacija. Zastoj vlasničkog testa bio je selektor filtera, a ne potvrđen kvar administracije. Rezultati ne znače korisničko prihvatanje ili produkcionu spremnost.

Sledeće: pregled/provera svakodnevnog rada korisnika i vlasnika, eventualne potvrđene popravke i ostatak završne matrice/operativne predaje. Telefon + lozinka ostaje zaseban završni blok pre produkcije; sada se Auth ne menja. Posle toga sledi zasebna produkciona aktivacija. Faza 11 je van prve verzije; konfliktna objava rasporeda se odbija bez automatskog otkazivanja.

Razvojni projekat je `xfbjgxtgvlyndonhlupm`; buduća produkcija je `usokysukvtgtvrtxnjai`. Pre nastavka treba obezbediti pouzdan pristup test projektu. Domen/mejl nisu preduslov blokova A–D. Za aktivaciju ostaju produkciona šema/podešavanja, pravi vlasnik, domen/SMTP/potvrda i oporavak mejla, realni kontakti, hosting/HTTPS i završne provere. Testni korisnici/rezervacije se ne kopiraju; promena URL-a/ključa sama nije završetak. Tajne ne unositi u dokumentaciju ili Git.

Sve nezavršene izmene ostaju sačuvane na `phase/07-booking`, bez commit-a/push-a/objave. Stvarna istorija četiri već primenjene migracije je u [Supabase zapisniku](../vule-still/supabase/DEPLOYMENT.md); ne primenjivati ih ponovo. [Najnovija predaja](../PHASE_PLAN.md) daje tačno stanje, korisničku listu za pregled i sledeći prompt.
