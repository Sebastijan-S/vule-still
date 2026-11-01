# Vule Still — PRD

Verzija 1.0 • 31.10.2026. • Specifikacija za pregled pre izrade.

Izvor zahteva: opis nove aplikacije, četiri dostavljena screenshota i odgovori 1–43 iz [registra odluka](ODLUKE.md). Oznake P1–P13 u registru predstavljaju predložena tumačenja detalja.

## 1. Cilj i korisnici

Napraviti modernu web aplikaciju u kojoj klijent sam rezerviše slobodan termin, a vlasnik upravlja rasporedom jednog frizera na dve lokacije. Očekivano korišćenje je 11–20 rezervacija dnevno ukupno. Aplikacija je na srpskom, latinicom, prvenstveno prilagođena telefonu.

Posetilac bez naloga vidi usluge, lokacije i slobodne termine. Prijavljen korisnik rezerviše za sebe ili drugu osobu i upravlja svojim rezervacijama. Jedan ovlašćeni vlasnik upravlja obema lokacijama, rasporedom, uslugama i ručnim rezervacijama.

## 2. Obim prve verzije

Uključeni su javna početna stranica, rezervisanje kroz korake, prijava kodom, profil, Moji termini, obaveštenja unutar aplikacije i administracija. Podaci se trajno čuvaju u Supabase-u. Počinje se sa praznom bazom.

U ovoj verziji nema cena, online plaćanja, kombinovanja više usluga, korisničkog pomeranja termina jednim korakom, više frizera, liste čekanja, programa lojalnosti, mobilnih aplikacija za prodavnice, SMS-a, push poruka, imejlova o rezervacijama ili zakazanih podsetnika. Jedini imejl aplikacije jeste kod za prijavu.

## 3. Brend i ekrani

Naziv je svuda Vule Still. Koriste se postojeći logotipi i hero fotografija. Dizajn prati dostavljene reference: skoro crna podloga, svetao tekst, crveni detalji, velika tipografija i jasna dugmad. Zadržati prepoznatljive sekcije, uz raspored prilagođen malim ekranima. Fotografija je ilustrativna i ne predstavlja dokumentarnu fotografiju salona.

| Ekran | Sadržaj i ponašanje |
| --- | --- |
| Početna | Logo, hero, „Rezerviši termin“, usluge, lokacije, završni poziv na rezervaciju, footer |
| Rezervacija | Lokacija → Usluga → Datum i termin → Potvrda; vidljiv napredak i povratak |
| Prijava | Imejl, slanje koda, unos koda, ponovno slanje sa ograničenjem, povratak na sačuvan izbor |
| Profil | Ime, prezime i telefon, prikaz verifikovanog imejla, odjava |
| Moji termini | Budući i prethodni termini, detalji, otkazivanje, obaveštenja o promenama |
| Admin: kalendar | Dnevni/nedeljni pregled, filter lokacije, detalji, ručni unos i izmena |
| Admin: raspored | Nedeljni nacrt, smene, pauze, neradni dani, razmak između lokacija, objava |
| Admin: usluge | Naziv, kategorija, trajanje, redosled i aktivnost |
| Admin: korisnici | Pretraga, pregled rezervacija, blokiranje i odblokiranje uz trag izmene |

Generički kontakti koriste se samo kao jasno označeni primeri. Podaci brenda i lokacija drže se centralno i lako se menjaju. Javna aktivacija ne sme da prikazuje izmišljeni kontakt kao stvaran.

## 4. Usluge

Korisnik bira tačno jednu konkretnu uslugu. „Premium usluge“ je sklopiva kategorija sa pojedinačnim izborom, a ne rezervabilna usluga.

| Usluga | Kategorija | Početno trajanje |
| --- | --- | --- |
| Klasično šišanje | Standard | 20 min |
| Šišanje sa izbrijavanjem | Standard | 20 min |
| Brada | Standard | 20 min |
| Šišanje i brada | Standard | 20 min |
| Oblikovanje obrva britvom | Premium | 40 min |
| Tretman toplim peškirom | Premium | 40 min |
| Tretman ušnim svećama | Premium | 40 min |

Ponuda i trajanja zajednički su za obe lokacije. Administrator menja trajanja za nove rezervacije. Potvrđena rezervacija čuva naziv i trajanje iz trenutka rezervisanja. Deaktiviranje usluge sprečava nove izbore, a istorija ostaje dostupna.

## 5. Raspored i dostupnost

Početni nedeljni šablon: ponedeljak–subota, Zrenjanin 10:00–15:00, Neuzin 17:00–20:00; nedelja zatvorena. Vlasnik ga menja i ručno označava praznike i odsustva.

Šablon služi za pripremu konkretnih nedelja. Svaka nedelja ima nacrt i objavljenu verziju. Dok vlasnik ne potvrdi raspored, ne nude se termini za tu nedelju. Objavljivanje više nedelja ne proširuje pravilo rezervisanja do 14 dana unapred. Na početku rada potrebno je objaviti i tekuću nedelju.

Kalendar svake lokacije ima poseban prikaz, ali frizer je jedan zajednički resurs. Nije dozvoljeno da radi na obe lokacije istovremeno. Između smena različitih lokacija podrazumeva se 60 minuta za prelazak; vlasnik može da promeni razmak ili postavi 0. Ne postoji automatska pauza između dve rezervacije na istoj lokaciji.

Dostupnost nastaje iz objavljenih smena, aktivne usluge, pauza, odsustava, potvrđenih rezervacija na obe lokacije i važećeg razmaka između lokacija. Prazan rezultat razlikuje neobjavljen raspored, neradni dan, popunjen dan i dan na kojem nema dovoljno dugog slobodnog perioda.

### Pravila vremena

- Sva poslovna pravila koriste Europe/Belgrade; vreme se prikazuje 24-časovno, datum kao dd.mm.gggg.
- Cela usluga mora da stane u objavljenu smenu bez prolaska kroz pauzu ili blokadu.
- Početak je najmanje 15 minuta u budućnosti prema serverskom vremenu.
- Dostupni datumi su od danas do danas + 14 dana uključivo, prema predlogu P2.
- Počeci se nižu u koracima trajanja usluge od početka svakog slobodnog perioda. Rok od 15 minuta filtrira postojeći niz, ne stvara novu početnu tačku.
- Intervali se dodiruju bez preklapanja: završetak u 10:20 dozvoljava sledeći početak u 10:20 na istoj lokaciji.
- Serverska provera važi i kada korisnik ručno izmeni zahtev ili ostavi ekran otvoren duže vreme.

### Konkretni primeri

| Situacija | Očekivano ponašanje |
| --- | --- |
| Prazan Zrenjanin 10–15, usluga 20 min | Počeci 10:00, 10:20…14:40 |
| Prazan Zrenjanin 10–15, usluga 40 min | Počeci 10:00, 10:40…14:00; preostalih 20 minuta nije dovoljno |
| Prazan Neuzin 17–20, usluga 40 min | Počeci 17:00, 17:40, 18:20, 19:00 |
| Zauzeto 10:40–11:00, usluga 40 min | U prvom periodu 10:00; naredni niz počinje u 11:00 |
| Danas je 10:10, prazna smena od 10, usluga 20 min | 10:20 je preblizu; prvi dozvoljeni početak 10:40 |
| Datum je unutar 14 dana, nedelja nije objavljena | Nema rezervacije; poruka „Raspored još nije objavljen“ |

## 6. Prijava, profil i sesija

I registracija i ponovna prijava koriste isti tok: imejl → jednokratni kod → verifikovana sesija. Sam unos imejla nikada ne daje pristup tuđem nalogu. Novi korisnik nakon verifikacije dopunjava ime, prezime i telefon pre potvrde prve rezervacije. Telefon se validira po formatu, ali se ne potvrđuje SMS-om.

Predložena podešavanja: kod važi 10 minuta, ponovno slanje najranije posle 60 sekundi, ograničenja slanja i pokušaja sprovode se serverski. Tačan format koda prati podržanu konfiguraciju Supabase Auth-a. Ne uvoditi paralelan, samostalno napravljen sistem kodova.

Izbor lokacije/usluge/datuma/vremena čuva se pri prijavi i osvežavanju. Sačuvan izbor nije zauzeće termina; dostupnost se ponovo proverava. Ako usluga ili raspored više nisu validni, sačuvati važeće izbore i jasno objasniti šta treba ponoviti.

Aktivnost na bilo kom uređaju održava nalog aktivnim. Posle 30 dana bez aktivnosti na celom nalogu potreban je novi kod. Ovo pravilo mora da štiti pristup na serveru i u bazi, ne samo prikaz stranice. Pozadinsko osvežavanje tokena nije aktivnost. Odjava na jednom uređaju ostavlja ga odjavljenim.

## 7. Potvrda rezervacije

Pregled pre dugmeta „Potvrdi rezervaciju“ sadrži lokaciju, konkretnu uslugu, datum, početak, završetak, imejl vlasnika naloga i ime osobe koja dolazi. Za rezervaciju za drugu osobu obavezno je njeno ime; kontakt ostaje sa naloga korisnika.

Potvrđivanje u jednoj transakciji proverava nalog, potpun profil, zabranu rezervisanja, aktivnost usluge, objavljen raspored, trajanje, rokove, preklapanje i putovanje. Tek potom nastaju rezervacija i potvrda u aplikaciji. Ponovljen isti zahtev ne sme da napravi duplikat.

Ako dva korisnika potvrde isti period, uspeva samo jedan. Drugom se prikazuje poruka „Ovaj termin je upravo zauzet. Izaberi drugi slobodan termin.“ Izbor usluge i lokacije ostaje sačuvan.

Neograničen broj budućih rezervacija dozvoljen je ako se međusobno ne preklapaju. Za prvu verziju svaka rezervacija automatski dobija status „Potvrđena“.

## 8. Moji termini i obaveštenja

Korisnik vidi samo rezervacije povezane sa svojim nalogom, uključujući one za drugu osobu. Statusi su samo „Potvrđena“ i „Otkazana“; prošli termini se grupišu po vremenu bez uvođenja dodatnog statusa.

Otkazivanje je dozvoljeno najmanje 30 minuta pre početka, uz potvrdu radnje. Oslobađa se ceo interval. Korisničko pomeranje se obavlja otkazivanjem i novom rezervacijom; novi termin nije garantovan dok se ne potvrdi.

Potvrda, izmena i otkazivanje stvaraju trajno obaveštenje u aplikaciji. Prikazuje se oznaka nepročitanog i šta je promenjeno. Nema spoljne dostave niti podsetnika 24 h/1 h. Korisnik koji ne otvori aplikaciju neće primiti obaveštenje; vlasnik po potrebi koristi dostavljeni telefon. Vlasnik obaveštenja prati kroz kalendar i detalje rezervacije.

## 9. Administracija

Pristup ima samo eksplicitno dodeljen vlasnički nalog. Korisnik ne može da dodeli sebi ovu ulogu uređivanjem profila ili zahteva.

Vlasnik vidi raspored i detalje rezervacija, dodaje ručni termin uz samo ime klijenta i po želji kontakt. Ručni termin zauzima isti resurs i prolazi iste provere dostupnosti. Kada nema nalog/kontakt, obaveštenje klijentu u aplikaciji nije moguće; to mora biti jasno u admin prikazu.

Redovni rokovi 15 minuta/14 dana i rad unutar objavljenih smena važe i za vlasnika. Izmena postojeće rezervacije je atomska: prethodni termin ostaje zauzet dok novi nije uspešno prihvaćen. Po predlogu P6, promenu usluge rešavamo otkazivanjem i novim unosom.

Vlasnik može vanredno da otkaže budući termin manje od 30 minuta pre početka, uz obavezan razlog i posebnu potvrdu. To nije dozvola za preklapanje ili zaobilaženje ostalih pravila.

### Promene rasporeda

Izmena smene, pauze, odsustva, lokacije ili razmaka prikazuje pogođene buduće rezervacije. Vlasnik potvrđuje tačan spisak otkazivanja. Izmena, otkazivanja, obaveštenja i trag radnje nastaju zajedno. Pre konačnog upisa ponovo se proverava da nije nastala nova rezervacija; zastareo pregled zahteva novo potvrđivanje. Već započeta usluga ne može se ukloniti promenom rasporeda u prvoj verziji.

### Blokiranje naloga

Vlasnik vidi buduće termine koji će biti otkazani, unosi razlog i potvrđuje zabranu. Sve buduće rezervacije naloga se otkazuju, uključujući rezervacije za druge osobe. Za termine unutar 30 minuta koristi se isti eksplicitni izuzetak. Zabranjeni korisnik i dalje može da se prijavi i vidi obaveštenja/istoriju, ali ne može da rezerviše. Odblokiranje ne vraća ranije otkazane termine.

## 10. Kvalitet i podaci

Interaktivni elementi moraju da budu čitljivi, dostupni tastaturom i pogodni za dodir; cilj je najmanje 44 × 44 px za glavne akcije. Proveriti širine 360, 390 i 1280 px, bez horizontalnog skrolovanja sadržaja. Greške uz polja i poruke o učitavanju/čuvanju moraju biti na srpskom.

Javni API prikazuje samo ponudu i dostupnost, nikada imena ili kontakte tuđih klijenata. Identitet, ovlašćenja i sva vremenska pravila proveravaju se na serveru. Baza je konačni izvor podataka. localStorage može čuvati nezavršen izbor, ali ne predstavlja rezervaciju ili autorizaciju.

Potrebni su odvojeni podaci za razvoj/proveru i javni rad, kontrolisano čuvanje tajni, trag administratorskih promena i uputstvo za rezervnu kopiju i oporavak. Pre javnog rada priprema se obaveštenje o korišćenju ličnih podataka sa stvarnim kontaktom vlasnika; ovaj PRD ne utvrđuje pravne rokove čuvanja.

## 11. Kriterijumi prihvatanja

| ID | Proverljiv rezultat |
| --- | --- |
| A01 | Javni pregled radi bez naloga, a potvrda zahteva verifikovanu sesiju i potpun profil. |
| A02 | Pogrešan/istekao kod ne daje pristup; ponovni validni ulazak vraća sačuvan izbor. |
| A03 | Jedna rezervacija ima jednu konkretnu uslugu; premium kategorija sama nije izbor. |
| A04 | Prikaz odgovara tabeli primera i ne nudi kraj van smene. |
| A05 | Granice 15 minuta, 30 minuta i 14 dana proveravaju se serverski, uključujući tačne granične trenutke. |
| A06 | Neobjavljena nedelja ne može da primi rezervaciju ni direktnim zahtevom. |
| A07 | Dve paralelne potvrde preklapajućih intervala ne mogu obe uspeti; ponavljanje istog zahteva ne stvara duplikat. |
| A08 | Isti frizer ne može da bude zauzet na obe lokacije; promena razmaka proverava ceo pogođeni raspored. |
| A09 | Korisnik ne može da čita, menja ili otkazuje tuđu rezervaciju, ni direktno kroz bazni API. |
| A10 | Redovno otkazivanje oslobađa interval; kasno korisničko otkazivanje se odbija. |
| A11 | Vlasnik može da napravi ručnu rezervaciju samo sa imenom; nema lažnog korisničkog naloga. |
| A12 | Vanredno otkazivanje zahteva vlasničku ulogu, razlog i potvrdu, uz zapis radnje. |
| A13 | Promena rasporeda otkazuje samo izričito potvrđen spisak; paralelno nastao konflikt ne prolazi tiho. |
| A14 | Promena trajanja ne menja ranije potvrđene rezervacije. |
| A15 | Blokiranje sprečava nove rezervacije, otkazuje buduće i ostavlja pristup istoriji/obaveštenjima. |
| A16 | Aktivnost telefona održava nalog na računaru; nakon 30 dana ukupne neaktivnosti stari pristup ne može da se koristi. |
| A17 | Rezervacije ne šalju imejlove; autentifikacija šalje pravi kod na adresu koja nije deo razvojnog tima. |
| A18 | Potvrde i promene su trajno vidljive u aplikaciji; ručni klijent bez naloga nema lažno obećanje dostave. |
| A19 | Prikaz i pravila vremena rade tokom zimskog/letnjeg vremena i na uređaju u drugoj zoni. |
| A20 | Mobilni tok, povratak po koracima, učitavanje, prazan rezultat i greške rade na dogovorenim širinama. |

Status provera: kriterijumi aplikacije su planirani; postoje Next.js temelj i početni SQL paket, ali poslovni tokovi još nisu implementirani. Izolovane SQL provere dokumentuju se u `vule-still/supabase/`; one nisu potvrda prolaza kompletnog kriterijuma A01–A20 na stvarnom Supabase okruženju.
