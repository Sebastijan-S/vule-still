# Vule Still — plan unapređenja interfejsa i zakazivanja više usluga

**25. novembar 2026. · Plan za implementaciju po koracima**

Klijent treba da može da izabere jednu ili više usluga, vidi koliko dolazak traje i pronađe odgovarajuće vreme. Vlasnik treba da vidi sve usluge tog dolaska na jednoj rezervaciji. Zadržavamo postojeći tamni izgled, logo, fotografiju i Manrope. Nove rezervacije su trenutno dostupne u Neuzinu. Premium usluge povlačimo iz nove ponude i čuvamo za kasniji povratak.

**Polazna tačka za kod:** [GitHub commit 8c1d432 na grani phase/07-booking](https://github.com/Sebastijan-S/vule-still/commit/8c1d4322ebea1cd75cdfc9d2eab4244f9a7bac2d). Git čuva izvorni kod i migracije. Pre buduće migracije podataka posebno proveriti stanje i mogućnost oporavka test baze.

## Osnova plana

- **U pregledaču:** klik na „Brada · 10 min“ u katalogu danas vodi na izbor jedine lokacije, pa ponovo na već označenu uslugu. Na telefonu je prijavi prethodio veliki slogan, a pri dolasku iz „Mojih termina“ povratni link je vodio na zakazivanje. U detaljima termina već se prikazuje mejl kada nema telefona.
- **Prazna, popunjena i neuspešna stanja:** pregledani su neobjavljen raspored, neispravan kontakt, profil, nalog sa 18 kartica i 41 obaveštenjem, ručni unos, prazna i pripremljena nedelja i šablon. Kada katalog nije mogao da se učita, nestale su obe sekcije na koje vodi navigacija. Nakon aktiviranja test projekta ponovo je prikazano svih sedam usluga. Pregled rezervacije sa slobodnim vremenom proveren je simuliranim terminom. Stvarni termin tada nije rezervisan.
- **U kodu:** izbor, dostupnost, javna potvrda i vlasnički unos trenutno primaju jednu uslugu. Rezervacija ima jedan `service_id`, sačuvan naziv i trajanje. Zahtev za više usluga menja ranije pravilo iz [PRD-a](PRD.md). Važeća pravila za kontakt gosta, lokacije i trajanja opisana su u [potvrđenim izmenama](IZMENE-2026-11-14.md).

## Redosled implementacije

Svaka numerisana celina ima sopstvenu proveru i može da bude poseban commit. Koraci 2 i 3 čine jednu funkcionalnost: korisnički izbor više usluga uključiti tek kada ga podržavaju baza, dostupnost, potvrda i prikaz vlasnika.

### 1. P0 — Privremeno povući premium ponudu

**Problem.** Tri premium usluge prikazuju se na početnoj, u javnoj rezervaciji i među uslugama za ručni unos. Forma rezervacije iscrtava naslov premium grupe čak i ako nema stavki.

**Rezultat.** Iskoristiti postojeće `services.is_active` za tri postojeća reda. Sačuvati njihove ID-jeve, kategorije, nazive i trajanja. Grupe prikazivati samo ako imaju stavke. Dok postoje samo četiri standardne usluge, dovoljan je naslov „Usluge“. Stari link ili nacrt sa povučenom uslugom vodi do dostupnih opcija i kratkog objašnjenja. Već potvrđeni termini ostaju dostupni u istoriji i redovnom upravljanju.

**Gde.** Početna i katalog, javni izbor usluga, vlasnički ručni unos, migracije kataloga i provere aktivne usluge pri potvrdi.

**Provera.** Četiri usluge na sva tri mesta, bez prazne premium grupe. Nova javna i ručna rezervacija povučene usluge odbijaju se i direktnim zahtevom. Istorijska premium rezervacija zadržava svoj naziv i trajanje. U izolovanom testu vratiti iste tri stavke u ponudu bez izmene UI koda.

### 2. P0 — Jedan dolazak sa više usluga: podaci i pravila

**Status 25.11.2026:** Implementirano i provereno na test projektu; UI izbor još nije uključen. Prošlo je 152 izolovanih SQL provera, 25 lokalnih testova i osam ciljanih Chrome testova, uključujući stvarne paralelne potvrde. Postojećih 47 rezervacija preneto je bez izmene izvornih vrednosti. Detalji i granice oporavka su u [zapisniku migracije](../vule-still/supabase/DEPLOYMENT.md), a sledeći je korak 3.

**Problem.** Dodavanje kućica za izbor u sadašnjoj formi ostavilo bi računanje vremena i potvrdu vezane za samo jednu uslugu. Klijentu bi mogao biti ponuđen period prekratak za ceo dolazak.

**Rezultat.** Jedna rezervacija pripada jednoj osobi, jednoj lokaciji i jednom frizeru. Ima jedan početak, jedan kraj, jedan status i jednu ili više različitih aktivnih usluga. Trajanja se sabiraju. „Klasično šišanje“ (20 min) i „Brada“ (10 min) zauzimaju neprekinutih 30 minuta. Svaka kataloška usluga može se izabrati jednom. „Šišanje i brada“ ostaje postojeća zasebna usluga od 30 minuta. Predloženo pravilo za prvu verziju je da se različite stavke računaju kako su označene, bez automatskog spajanja na osnovu naziva.

**Izvedba.**

- Dodati stavke rezervacije sa vezom na rezervaciju i uslugu, redosledom i sačuvanim nazivom i trajanjem svake stavke. Roditeljska rezervacija i dalje određuje ceo zauzeti interval. Za svaku postojeću rezervaciju preneti po jednu stavku iz njenih **sačuvanih** vrednosti, uključujući otkazane i premium termine. Redosled stavki pratiti prema katalogu, nezavisno od redosleda klikova.
- Dopuniti javni i vlasnički API i SQL funkcije za izbor više ID-jeva. Stari zahtev sa jednom uslugom mora i dalje da radi kao izbor jedne stavke. Baza proverava aktivnost, nazive i trajanja, izračunava zbir i atomskom potvrdom upisuje rezervaciju i sve stavke. Raniji prikaz trajanja na klijentu služi za proveru da li se ponuda u međuvremenu promenila.
- Isti zbir koristiti za ponuđene početke i za proveru pri potvrdi. Sve usluge moraju stati u isti slobodan period, unutar objavljene smene, bez prelaska preko pauze, drugog termina ili razmaka za prelazak između lokacija. Za izmenu datuma ili vremena koristiti prvobitno sačuvano ukupno trajanje. Otkazivanje oslobađa ceo interval. Promena sastava već potvrđenog dolaska prati postojeći postupak otkazivanja i nove rezervacije.
- Jedan ključ zahteva važi za ceo izbor. Posle nepoznatog ishoda prvo proveriti isti zahtev, čak i ako je usluga u međuvremenu povučena. Pre uključivanja UI-ja ažurirati tipove, odgovore za „Moje termine“, vlasničke kartice, potvrde i obaveštenja.

**Gde.** [Pravila dostupnosti](../vule-still/src/lib/availability.ts), [ugovor javne potvrde](../vule-still/src/lib/booking.ts), [vlasnički unos](../vule-still/src/lib/owner-booking.ts), API rute za dostupnost/rezervacije, Supabase migracije i pripadajući SQL testovi.

**Provera.** Blok 16:00–16:30 prima izbor 20 + 10 min; blok od 20 minuta ili dva odvojena bloka od 20 i 10 ga ne primaju. Paralelne potvrde koje dele deo intervala daju najviše jednu rezervaciju. Dvostruki klik ili ponavljanje istog zahteva daje jedan dolazak. Proveriti praznu listu, duplikat ID-ja, povučenu stavku, promenu trajanja između pregleda i potvrde, pojedinačan stari zahtev, pomeranje i otkazivanje cele kombinacije.

### 3. P0 — Skraćeno zakazivanje i izbor više usluga

**Korisničko odobrenje 25.11.2026:** Korak 3 odobren je za commit i normalni push na `phase/07-booking`. Sledeći rad je korak 4, koji se vodi odvojeno od ovog checkpointa.

**Status 25.11.2026:** Implementiran javni i vlasnički višestruki izbor; spremno za korisnički pregled. Jedina lokacija se preskače, direktni linkovi vode na vreme, ceo nacrt i stari scalar format ostaju čitljivi, a pending zahtev koristi svoj originalni payload. Provere i granice dokaza: [RESULTS.md](../vule-still/supabase/tests/RESULTS.md). Bez nove migracije, promene produkcije, commit-a ili push-a. Koraci 4–8 nisu uključeni u ovaj korak.

**Problem.** Opšti ulaz zahteva izbor jedine lokacije. Link sa konkretne usluge ponavlja poznate odluke. Danas sam klik na uslugu odmah prebacuje klijenta na datum, što onemogućava izbor druge stavke.

**Rezultat.**

- Dok je aktivna samo jedna lokacija, prikazati „Neuzin“ kao deo sažetka. Kada se otvori druga, vratiti izbor lokacije. Opšte dugme „Rezerviši termin“ otvara listu sa jasno označivim uslugama, pojedinačnim trajanjem, ukupnim minutima i dugmetom „Izaberi vreme“. Dugme je aktivno posle prvog izbora.
- Klik na konkretnu uslugu iz kataloga otvara izbor vremena sa tom uslugom već označenom. Pored sažetka je „Dodaj ili promeni usluge“. Izmena zadržava lokaciju i datum, ponovo učitava vremena i zadržava početak samo ako je i dalje dostupan za novi zbir. Stari link `?usluga=brada` ostaje važeći.
- Prenositi ceo izbor kroz prijavu, dopunu profila, osvežavanje i povratak na prethodni korak. Čitati i stare sačuvane izbore sa jednom uslugom. Ako je jedna od više izabranih usluga povučena, prikazati preostale i tražiti pregled izmenjenog izbora pre nastavka.
- Na pregledu prikazati svaku stavku, ukupno trajanje, lokaciju, osobu i početak–kraj. Posle potvrde klijent i vlasnik vide jedan termin sa svim uslugama. Vlasnik pri ručnom unosu koristi isti izbor i zbir. Za dolazak druge osobe sva izabrana nega pripada toj osobi.

**Gde.** [Forma zakazivanja](../vule-still/src/app/(public)/rezervacija/booking-form.tsx), početna, prijava/profil, klijentske kartice i [vlasničke rezervacije](../vule-still/src/app/(owner)/administracija/owner-appointments.tsx).

**Provera.** Na telefonu i desktopu proći direktan link za jednu uslugu, opšti ulaz za dve usluge, uklanjanje poslednje stavke, promenu trajanja posle izbora vremena, povratak iz prijave/profila i ručni unos. Zbir i kraj termina moraju biti isti na izboru, pregledu, potvrdi, u „Mojim terminima“ i kod vlasnika. Testirati i povratak druge aktivne lokacije na izolovanim podacima.

### 4. P1 — Čitljivost, pristupačnost i tamna tema

**Korisničko odobrenje 26.11.2026:** Korak 4 odobren je za commit i normalni push na `phase/07-booking`, uz evidentiranu granicu govorne provere čitača ekrana. Sledeći implementacioni rad je korak 5 u novom chatu.

**Status 25.11.2026:** Implementirano za korisnički pregled posle push-a koraka 3 (`30e0cdf`). Osnovni tekst/unosi su 16 px, pomoćni tekst i akcije najmanje 14 px. Primarna dugmad imaju tamniju crvenu, jasni su fokus i destruktivne akcije. Vreme koristi nativnu radio grupu u javnom i ručnom unosu. Greške su povezane sa kontaktom, imenom osobe i vremenima smene; dijalog kruži Tab fokus i vraća ga na otvarač. Provere i granice asistivne provere vode se u [RESULTS.md](../vule-still/supabase/tests/RESULTS.md). Korak 4 nije commitovan niti pushovan; koraci 5–8 ostaju odvojeni.

**Problem.** Mobilna navigacija i pomoćni tekst često su 11 px. Beli tekst na osnovnom crvenom dugmetu ima kontrast oko 4,19 : 1. Oznaka izbora u postojećim opcijama izrazito se oslanja na boju.

**Rezultat.** U [zajedničkim stilovima](../vule-still/src/app/globals.css) ujednačiti osnovni tekst i unos na 16 px, a akcije, bitna uputstva i greške na najmanje 14 px. Podesiti tamniju crvenu površinu za beli tekst dugmeta. Ujednačiti primarnu, sekundarnu i destruktivnu akciju, fokus, grešku i uspeh. Za više usluga koristiti imenovane kućice za izbor sa vidljivom oznakom. Za vreme se bira samo jedan početak.

**Provera.** Proveriti običan tekst sa ciljem kontrasta najmanje 4,5 : 1, dodirne površine važnih akcija oko 44 × 44 px ili veće, širine 360/390/768/1280 px i zum od 200%. Tastaturom i čitačem ekrana proći izbor dve usluge, objavu ukupnog trajanja, prelazak na sledeći korak, grešku uz polje i zatvaranje dijaloga uz povratak fokusa.

### 5. P1 — Početna stranica i mobilna navigacija

**Problem.** Lista usluga dolazi posle promotivne kartice i trake slogana. Prva kartica lokacije pripada Zrenjaninu, iako je Neuzin otvoren za zakazivanje. Na mobilnom zaglavlje skriva dugme za rezervaciju.

**Rezultat.** Zadržati glavnu fotografiju i „Tvoj stil. Tvoj potpis.“ Ukloniti traku slogana, bočni natpis i promotivnu karticu. Posle uvoda prikazati usluge sa trajanjem, zatim Neuzin sa akcijom i kraću najavu za Zrenjanin. Na telefonu istaknuti „Rezerviši“ i „Moji termini“, a sekundarne linkove staviti u meni. Na desktopu zadržati vidljivu glavnu navigaciju.

**Gde i provera.** [Početna stranica](../vule-still/src/app/(public)/page.tsx) i [javno zaglavlje](../vule-still/src/components/site-shell.tsx). Na telefonu se iz menija „Usluge“ stiže odmah do prve usluge. Proveriti otvaranje i zatvaranje menija tastaturom, direktan izbor usluge i da samo aktivna lokacija ima akciju za rezervaciju.

### 6. P1 — Dostupnost, prazna stanja i oporavak od greške

**Problem.** Jedna neuspešna komponenta kataloga uklanja obe sekcije i mete linkova „Usluge“ i „Lokacije“. Pri grešci učitavanja rezervacije gubi se kontekst stranice. Neobjavljen raspored traži drugačiju poruku od zauzetog dana ili prekratkog perioda.

**Rezultat.** Zadržati naslove i navigaciju, učitavati sekcije nezavisno i ponuditi „Pokušaj ponovo“ u pogođenoj sekciji. Na datumu prikazati razlog i smislen naredni potez: drugi datum za neradni ili popunjen dan, drugi datum ili izmenu usluga kada nema dovoljno dugog perioda, ponovno učitavanje kada veza ne radi. Posle nepoznatog ishoda potvrde zadržati „Proveri isti zahtev“ i pristup „Mojim terminima“.

**Gde i provera.** Katalog, korak izbora vremena, vlasnički ručni unos i granice grešaka stranica. Nezavisno simulirati pad usluga, lokacija, dostupnosti i gubitak odgovora posle potvrde. Proveriti da izbor ostaje sačuvan, da obe navigacione mete postoje i da greška veze ne izgleda kao rasprodat dan.

### 7. P1 — Prijava, profil i „Moji termini“

**Problem.** Prijava ponavlja kako se unosi kontakt; profil i kartice koriste prostor za generičke poruke. Duga istorija i pročitana obaveštenja potiskuju informacije o narednom dolasku. Poruka `PROFILE_REQUIRED` još traži telefon iako je dovoljan i mejl.

**Rezultat.** Jedno pitanje za telefon ili mejl, greška povezana sa poljem i kontekstualni povratak na rezervaciju ili „Moje termine“. Zadržati vidljivo objašnjenje da se raniji termini vezuju za sesiju u istom pregledaču i šta odjava znači za gosta. Tokom prve rezervacije istaknuti nedostajuće ime i prezime i radnju „Sačuvaj i nastavi“. U „Mojim terminima“ prvo prikazati naredni dolazak sa svim uslugama i nepročitane promene. Istorija i pročitane poruke dostupne su na zahtev.

**Gde i provera.** Javne rute `/prijava`, `/profil`, `/moji-termini` i mapiranje grešaka potvrde. Proći kontakt samo mejlom i samo telefonom, grešku unosa, povratak iz oba toka, praznu i dugu istoriju, dolazak za drugu osobu, otkazani termin i granicu od 30 minuta. Datum, vreme i status moraju biti čitljivi pre otvaranja detalja.

### 8. P2 — Svakodnevni rad vlasnika

**Problem.** Filter istorije i ručni unos dele listu lokacija otvorenih za zakazivanje. Na telefonu je kalendar širok 792 px u prostoru od 348 px. Dijalog u šablonu kaže „Primeni u nacrtu“ iako menja šablon.

**Rezultat.** Dozvoliti pretragu istorije po obe lokacije, a izbor za novo zakazivanje ograničiti na otvorene lokacije. Na telefonu prvo prikazati izabrani dan i smene sa pauzama po lokaciji. Zadržati nedeljnu mrežu i postojeća dva kalendara na desktopu. Razlikovati „Primeni u šablonu“, „Primeni u nacrtu“, „Sačuvaj nacrt“ i „Objavi nedelju“. Na kartici i pri pomeranju prikazati sve usluge i ukupno trajanje dolaska.

**Gde i provera.** Vlasničke rute `/administracija`, `/raspored` i `/administrator/sablon`. Proći filtriranu istoriju Zrenjanina, novi termin u Neuzinu, promenu datuma, praznu nedelju, pauzu, rad nedeljom, pripremljen nacrt i odbijenu konfliktnu objavu. Proveriti da promena šablona utiče samo na buduće novopripremljene nedelje.

## Završna provera i isporuka

1. Najpre završiti povlačenje premium usluga. Zatim na izolovanoj bazi proveriti migraciju i pravila za više usluga; na test projektu povezati javni i vlasnički UI. Pre uključivanja višestrukog izbora proveriti da i dotadašnji klijent može da zakaže jednu uslugu.
2. Prilagoditi postojeći test kataloga koji očekuje otvaranje premium sekcije. Administratorski test je pri pregledu očekivao kalendar u nepripremljenoj tekućoj nedelji. Odvojiti taj scenario od kalendara sa poznatim smenama i koristiti kontrolisane datume.
3. Izvršiti relevantne SQL, unit i Chrome provere, lint i test build. U korisničkom prolazu proveriti ceo put do stvarne potvrde i otkazivanja na testnim podacima, povratak iz prekida i da vlasnik vidi jednu rezervaciju sa svim stavkama.
4. Uz implementaciju uskladiti PRD, registar odluka i vlasničko uputstvo sa novim izborom više usluga. Prilikom povratka na prethodni UI sačuvati već nastale rezervacije sa više stavki i njihov ukupni interval. Git checkpoint služi za kod; povratak ne sme da obriše istoriju rezervacija.
