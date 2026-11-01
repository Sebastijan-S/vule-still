# Vule Still — registar odluka

Datum: 31.10.2026. Status: potvrđeni odgovori i posebno označeni projektni predlozi.

## Odgovori 1–30

| Broj | Tema | Potvrđena odluka |
| --- | --- | --- |
| 1 | Naziv | Vule Still |
| 2 | Dizajn | Veoma blizu screenshotovima, uz bolji mobilni prikaz |
| 3 | Sadržaj | Zadržati logo i fotografiju; generički javni kontakti za prototip |
| 4 | Tehnologija | Next.js sa TypeScriptom i Supabase |
| 5 | Frizer | Jedan isti frizer radi na obe lokacije |
| 6 | Radni dani | Početno ponedeljak–subota; administrator menja vreme i lokaciju rada |
| 7 | Praznici | Administrator ručno određuje neradne dane |
| 8 | Usluge | Zajednička ponuda i trajanja: standardne 20, premium 40 minuta |
| 9 | Cene | Bez prikaza cena; plaćanje u salonu |
| 10 | Počeci termina | Po trajanju usluge od početka svakog slobodnog perioda |
| 11 | Priprema | Nema automatske pauze između usluga |
| 12 | Horizont | 14 dana unapred |
| 13 | Najkasnije zakazivanje | Najmanje 15 minuta pre početka |
| 14 | Korisničko otkazivanje | Najmanje 30 minuta pre početka |
| 15 | Pomeranje | Korisnik otkazuje pa rezerviše ponovo; nema posebnog toka pomeranja |
| 16 | Broj rezervacija | Neograničen broj budućih rezervacija bez međusobnog preklapanja |
| 17 | Druga osoba | Dozvoljeno uz ime osobe koja dolazi |
| 18 | Prijava | Jednokratni kod putem imejla |
| 19 | Profil | Ime, prezime i telefon obavezni za korisničku rezervaciju |
| 20 | Sesija | Ponovna prijava posle 30 dana neaktivnosti |
| 21 | Podsetnici | Prvobitno 24 h i 1 h ranije; kasnije izbačeni odgovorima 32 i 41 |
| 22 | Vlasnik | Rezervacije i otkazivanja prati u administratorskom kalendaru |
| 23 | Ručni unos | Administrator može da dodaje i menja rezervacije |
| 24 | Ovlašćenja | Jedan vlasnik sa pristupom obema lokacijama |
| 25 | Statusi | Potvrđena i otkazana |
| 26 | Promena rasporeda | Prikaz pogođenih rezervacija, izričita potvrda otkazivanja i obaveštavanje |
| 27 | Zabrana | Administrator može ručno da zabrani nalogu nove rezervacije |
| 28 | Infrastruktura | Nalozi još nisu potvrđeni; redosled je plan, Supabase, prijava/registracija |
| 29 | Troškovi | Domen se kupuje; slanje poruka treba da ostane besplatno |
| 30 | Migracija | Prazna baza; prethodna aplikacija služi kao referenca |

## Odgovori 31–43

| Broj | Tema | Potvrđena odluka |
| --- | --- | --- |
| 31 | Hosting | Bez mesečne pretplate, uz dozvoljenu komercijalnu upotrebu |
| 32 | Poruke | Potvrde ostaju u aplikaciji; obim imejla dodatno razjašnjen odgovorom 41 |
| 33 | Obim rada | Očekivano 11–20 rezervacija dnevno ukupno |
| 34 | Putovanje | Početno 60 minuta između lokacija; administrator može promeniti ili ukloniti razmak |
| 35 | Objavljivanje | Nedeljni raspored, ali nedelja se otvara za rezervacije tek nakon potvrde administratora |
| 36 | Rokovi vlasnika | Važe isti rokovi kao za korisnika; izuzetak za otkazivanje dodat odgovorom 42 |
| 37 | Ručna rezervacija | Dovoljno je ime klijenta; nalog, telefon i imejl nisu obavezni |
| 38 | Trajanje | Već potvrđene rezervacije zadržavaju prethodno trajanje |
| 39 | Blokiranje | Uz izričitu potvrdu otkazuju se svi budući termini naloga i korisnik se obaveštava |
| 40 | Aktivnost | Računa se na nivou celog naloga, preko svih uređaja |
| 41 | Konačna prijava | Kod putem imejla ostaje; nema imejlova o rezervacijama ili podsetnika |
| 42 | Vanredno otkazivanje | Vlasnik sme da otkaže unutar 30 minuta uz razlog i izričitu potvrdu |
| 43 | Dostava promena | Korisnik ih vidi kada otvori aplikaciju; vlasnik po potrebi zove |

## Predložena tumačenja za implementaciju

Ovo su konkretizacije za pregled, ne dodatni odgovori korisnika. Njihove izmene ne zahtevaju ponovno popunjavanje upitnika.

| Oznaka | Predlog |
| --- | --- |
| P1 | Nedelja traje ponedeljak–nedelja po vremenu Srbije; jedna objava obuhvata obe lokacije istog frizera. |
| P2 | Granica od 14 dana znači današnji datum do datuma danas + 14, uključivo, ali samo unutar objavljenih smena. |
| P3 | Tačno 15 minuta pre početka rezervacija je dozvoljena; tačno 30 minuta pre početka redovno otkazivanje je dozvoljeno. Merodavno je serversko vreme. |
| P4 | Ako danas deo slobodnog perioda već prolazi, termini zadržavaju niz vezan za njegov početak, pa se nedozvoljeni počeci filtriraju. Sat ne pomera ceo niz termina. |
| P5 | Razmak za putovanje proverava se između smena različitih lokacija i pri svakoj izmeni rasporeda; početnih 60 minuta može da se zameni drugom nenegativnom vrednošću, uključujući 0. |
| P6 | Izmena rezervacije kod vlasnika u prvoj verziji menja lokaciju/datum/vreme/osobu i kontakt. Promena same usluge radi se kroz otkazivanje i novi unos. Pomerena rezervacija zadržava sačuvano trajanje. |
| P7 | Ručna rezervacija bez naloga ne povezuje se automatski po imenu. U prvoj verziji administrator upravlja njome; automatsko povezivanje sa kasnije nastalim nalogom nije u obimu. |
| P8 | Potvrde, otkazivanja i izmene čuvaju se kao obaveštenja u aplikaciji sa oznakom pročitano/nepročitano. Nema zakazanih podsetnika 24 h/1 h ni push poruka. |
| P9 | Aktivnost znači stvaran autentifikovan zahtev korisnika, a ne pozadinsko osvežavanje tokena. Posle 30 dana neaktivnosti naloga svi prethodni pristupi zahtevaju ponovnu autentifikaciju. Ručna odjava uređaja ga ne prijavljuje ponovo zbog aktivnosti drugog uređaja. |
| P10 | Generički kontakti u prototipu imaju očigledne oznake poput „Adresa — primer“ i ne vode na stvarne tuđe telefone/profil. Pred javno korišćenje zameniti ih ili sakriti. |
| P11 | Ako vlasnik blokira nalog, otkazuju se i njegove rezervacije za druge osobe. Već započete/prošle rezervacije ostaju istorija. Odblokiranje ne vraća otkazane termine. |
| P12 | Objavljen raspored ostaje aktivan dok se ne potvrdi izmenjena verzija. Nacrt ne utiče na postojeće rezervacije; neobjavljena nedelja nije isto što i popunjen dan. |
| P13 | Novi nalozi i postojeći korisnici koriste isti tok imejl + kod. Profil se dopunjava posle verifikacije, pre prve rezervacije. |

## Operativni podaci koji se unose kasnije

Supabase projekat je dostavljen i potvrđen kao nov i prazan: `usokysukvtgtvrtxnjai`, namenjen budućoj produkciji. Početni administratorski mejl je `sekosansebastijan@gmail.com`. Domen, tačni javni kontakti i datum javnog puštanja još nisu dostavljeni. Za javnu aktivaciju potrebni su povezani servisi i provereno slanje kodova. Ostalo vlasništvo nad repozitorijumom, domenom i hostingom treba utvrditi pre kreiranja tih naloga.

## Dodatne potvrđene odluke tokom pripreme baze

Ovi odgovori imaju prednost nad ranijim neodređenim detaljima. P2 je sada izričito potvrđen.

| Oznaka | Potvrđena odluka |
| --- | --- |
| DB01 | Isplanirati celu bazu, a prvo pripremiti temelj za naloge, administratorski pristup, lokacije i usluge. Jedan zajednički frizer ostaje poseban resurs prema SoW-u. |
| DB02 | Korisnik sam menja svoje ime, prezime i telefon. |
| DB03 | Uz sve rezervacije povezanog korisnika prikazuje se trenutni telefon iz profila, bez čuvanja kopije broja u svakoj rezervaciji. |
| DB04 | Administratoru su za pristup dovoljni verifikovan mejl i posebno dodeljeno ovlašćenje. Pun profil popunjava kada rezerviše kao običan korisnik. |
| DB05 | Nova trajanja usluga su pozitivni umnošci od 10 minuta, bez dodatnog poslovnog maksimuma. Početne vrednosti ostaju 20/40 minuta; cela usluga mora stati u slobodan period smene. |
| DB06 | Ručna rezervacija ima obavezno ime i opcioni telefon; nema mejl kontakta ni otvaranja naloga gostu. |
| DB07 | Administratorsko ovlašćenje čuva se u posebnoj tabeli `admin_memberships`, povezanoj sa Auth ID-jem. |
| DB08 | Prihvatati srpske i međunarodne telefone. Srpski unos može biti lokalni ili sa +381, strani sa međunarodnim kodom; nema SMS verifikacije. |
| DB09 | Horizont uključuje danas i datum danas + 14; na primer 31.10–14.11. |
| DB10 | Cloud Supabase projekat čuva se za buduću produkciju; razvojni i testni podaci treba da budu odvojeni. |
| DB11 | Raditi bez instalacije Dockera; sada pripremiti SQL datoteke. Nije zatražena primena na produkcioni projekat. |
| DB12 | Ne ponavljati pitanja za odluke koje su već potvrđene u planu; pitati samo za stvarno nedostajuće odluke. |
| DB13 | Naknadno je zatraženo da asistent preuzme povezivanje i kreiranje tabela na Supabase-u. Supabase dodatak je povezan, pa je 01.11.2026. primenjen početni paket i podešen Next.js klijent; test korisnici nisu upisivani u cloud. Ovo ažurira raniji status pripreme iz DB11. |

SQL paket i ograničenja opisani su u [Supabase uputstvu](../vule-still/supabase/README.md). Stvarno kreirane tabele, primenjene migracije i rezultati provera evidentirani su u [zapisniku primene](../vule-still/supabase/DEPLOYMENT.md). Admin članstvo čeka prvu verifikaciju dogovorenog mejla.
