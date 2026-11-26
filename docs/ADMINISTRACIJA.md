# Vule Still — kratko uputstvo za vlasnika

Lokalni testni ulaz: **http://127.0.0.1:3100/administrator**. Otvori u Google Chrome-u. Sajt i administracija koriste isti lokalni server i test projekat Vule-still-test. Na konačnom domenu ulaz će imati istu putanju `/administrator`; produkcija još nije objavljena.

Prijavi se postojećim vlasničkim nalogom. Važi trenutna testna prijava imejlom i lozinkom. Registracija običnog naloga i poznavanje direktnog linka ne daju vlasnička prava. Vlasništvo se proverava na serveru i u bazi; dodela ili prenos vlasništva nisu samostalna registracija. Telefon + lozinka ostaje zaseban završni posao.

Administratorsko zaglavlje ima tri odeljka, bez javnih sekcija sajta:

1. **Rezervacije:** odaberi datum, dan ili sedam dana od tog datuma. „Danas“/„Sutra“ ubrzavaju izbor. Filter istorije ima **Obe lokacije**, **Zrenjanin** i **Neuzin**, nezavisno od toga gde je novo zakazivanje otvoreno. Kartica pokazuje interval, lokaciju, osobu, kontakt, status, sve sačuvane usluge i ukupno trajanje; „Detalji i kontakt“ otvara dodatne podatke. Jedan frizer je zajednički za obe lokacije.
2. **Radno vreme:** na telefonu u polju **Izabrani dan** odaberi dan konkretne nedelje. Ispod se prikazuju smene i tačne pauze za svaku lokaciju, ili oznaka „Neradno“. Koristi **Izmeni smenu** ili **+ Dodaj smenu** uz lokaciju, bez vodoravnog pomeranja mreže. Na računaru ostaju dva nedeljna kalendara; klikni smenu ili **+** u zaglavlju dana. Ovo uređuje radno vreme, ne pravi rezervaciju klijenta.
3. **Uobičajena nedelja:** izmeni podrazumevane smene, pauze i razmak za buduće nacrte. Podržani su svi dani, uključujući nedelju. Šablon ima jednu smenu po lokaciji i danu; više konkretnih smena dodaje se u kalendaru nedelje.

## Ručni klijent, pomeranje i otkazivanje

Ako nema slobodnog vremena, poruka razlikuje neobjavljenu nedelju, neradan dan, zauzetost i prekratak slobodan period. „Izaberi drugi datum“ prebacuje fokus na datum; za novi ručni unos „Promeni usluge“ vraća fokus na izbor usluga. Pri pomeranju već potvrđenog dolaska njegov sastav ostaje isti. Greška veze kaže da dostupnost nije proverena i nudi „Pokušaj ponovo“; ime, kontakt, datum i izbor ostaju u otvorenoj formi. Sačuvaj tek kada uspešna provera ponovo potvrdi slobodan početak. Ako ishod upisa nije poznat, prvo „Proveri isti zahtev“ — nemoj unositi drugi ručni termin. Pri neuspelom učitavanju pregleda naslov/navigacija ostaju, a ponovni pokušaj ponovo čita podatke.

Izbor usluga možeš menjati tastaturom pomoću Tab i Space. Za slobodna vremena koristi Tab do radio grupe, pa strelice i Space; bira se jedan početak za ceo dolazak. Fokus je jasno označen, a destruktivne akcije imaju zaseban izgled. U dijalogu smene Tab/Shift+Tab ostaju među njegovim kontrolama; Escape ili „Zatvori“ vraćaju fokus na otvarač. Greška navodi pogođena polja i usmerava fokus na njih.

Od koraka 3 i forma za novi ručni unos bira više usluga. Označi jednu ili više kućica i proveri pojedinačna trajanja i zbir minuta. Sve usluge pripadaju jednoj osobi koja dolazi. Kartica prikazuje sve sačuvane stavke, a pomeranje koristi njihov prvobitni zbir. Izmena vremena i otkazivanje važe za ceo dolazak. Za promenu sastava otkaži termin i napravi novi.

Od 25.11.2026. za novo zakazivanje dostupne su četiri standardne usluge. Tri premium usluge su privremeno povučene, a ranije potvrđeni premium termini ostaju u pregledu sa sačuvanim nazivom i trajanjem. Mogu se pomerati i redovno otkazivati po istim pravilima. Povlačenje usluge ne otkazuje postojeći termin.

- **Dodaj ručni termin:** dovoljno je ime osobe; telefon je opcion. Nova rezervacija trenutno nudi samo **Neuzin**. Dostupnost Zrenjanina u istorijskom filteru ne otvara novo zakazivanje tamo. Izaberi jednu ili više usluga, datum i ponuđeni slobodni termin. Proveri zbir i početak–kraj, pa potvrdi. Bez usluge potvrda nije moguća. Promena izbora ponovo proverava slobodna vremena. Gostu se ne otvara nalog i nema obaveštenje u aplikaciji. Bez telefona nema kontakta za poziv.
- **Izmeni termin:** forma prvo pokazuje prethodni datum, ceo interval, lokaciju i sve sačuvane usluge sa zbirom. Promeni datum i izaberi novi ponuđeni početak–kraj; pomera se ceo dolazak sa prvobitnim trajanjem. Ime osobe i kontakt gosta mogu se izmeniti; povezani korisnik koristi trenutni telefon iz profila. Sastav usluga se ovde ne uređuje. Za njegovu promenu koristi otkazivanje i novi unos. Nova lokacija mora biti otvorena za zakazivanje; prikaz prvobitne lokacije postojećeg termina ne menja to pravilo.
- Neuspešno pomeranje čuva prethodni termin. Ako se izabrani termin u međuvremenu zauzme, osveži slobodne termine i izaberi drugi.
- **Otkaži termin:** potvrdi prikazanu radnju. Odustajanje u potvrdi ne menja rezervaciju. Za redovnu izmenu i otkazivanje mora ostati najmanje 30 minuta do starog početka. Novi početak mora biti najmanje 15 minuta u budućnosti, unutar objavljenog rada i horizonta do danas + 14 dana uključivo.
- Povezani korisnik dobija trajnu promenu/otkazivanje u aplikaciji kada je otvori. Nema booking mejlova, SMS-a, push poruka ili podsetnika. Ručni gost nema tu dostavu.
- Ako ishod mrežnog zahteva nije poznat, upotrebi **Proveri isti zahtev** pre nove operacije. Time se izbegava dupli unos.

## Smene, pauze, slobodni i neradni dani

Izaberi nedelju u **Radno vreme**. Ako još ne postoji, „Pripremi nedelju“ pravi nacrt iz trenutno sačuvane uobičajene nedelje. Za rad nedeljom na telefonu izaberi **Nedelju** i pritisni **+ Dodaj smenu** uz lokaciju; na računaru pritisni **+** u koloni „Ned“. Unesi radno vreme i po potrebi pauze. Dan može imati više smena. Za neradan dan ukloni sve njegove smene na obe lokacije. Prazan dan predstavlja neradan dan ili odsustvo.

Radnje imaju četiri različita značenja:

- **Primeni u šablonu:** zatvara dijalog i primenjuje lokalnu izmenu uobičajene nedelje. Zatim posebno pritisni **Sačuvaj uobičajenu nedelju**.
- **Primeni u nacrtu:** zatvara dijalog i primenjuje lokalnu izmenu konkretne nedelje. Još ništa nije sačuvano na serveru.
- **Sačuvaj nacrt:** čuva smene i razmak obe lokacije. Korisnicima i dalje važi prethodno objavljen raspored.
- **Objavi nedelju:** objavljuje prethodno sačuvan nacrt za obe lokacije. Tek objava menja dostupnost termina na lokacijama otvorenim za zakazivanje.

Oznaka razlikuje **Nesačuvane izmene**, **Sačuvan nacrt ima neobjavljene izmene**, neobjavljenu nedelju i nacrt koji odgovara objavljenom rasporedu. **Nacrt**/**Objavljeno** služe za poređenje istog izabranog dana; objavljeni prikaz je samo za čitanje. Za čuvanje ili objavu vrati se na nacrt. Dok postoje nesačuvane izmene, objava je onemogućena. Razmak između lokacija je podrazumevano 60 minuta i može se promeniti, uključujući 0, uz proveru zajedničkog frizera.

Ako bi objava ugrozila postojeću rezervaciju, biće odbijena bez otkazivanja i bez izmene aktivnog objavljenog rasporeda. Najpre pojedinačno pomeri ili redovno otkaži pogođenu rezervaciju, pa ponovi objavu. Nema izuzetka za kasno ili grupno otkazivanje.

## Promena uobičajene nedelje

U **Uobičajena nedelja** izmeni željeni dan/lokaciju, dodaj pauzu ili ukloni smenu za neradan dan, pa pritisni **Sačuvaj uobičajenu nedelju**. Ta promena važi samo za nedelje koje tek prvi put pripremiš. **Postojeći nacrti i objavljene nedelje ostaju nepromenjeni.** Njih po potrebi zasebno izmeni u **Radno vreme**, sačuvaj i objavi. Druga otvorena sesija ne može tiho prepisati noviju verziju šablona.

## Šta pregledati

Na telefonu i računaru proveri zaseban ulaz i navigaciju, dnevni/sedmodnevni pregled, ručni unos samo sa imenom, pomeranje na drugi datum, potvrdu otkazivanja, nedeljnu smenu/pauzu i razliku između šablona, nacrta i objave. Korisničko prihvatanje još nije evidentirano.

Rezultati automatizovanih i stvarnih provera: [rezultati](../vule-still/supabase/tests/RESULTS.md). Stanje i predaja: [plan faza](../PHASE_PLAN.md). Faza 11, završni Auth i produkciona aktivacija ostaju odvojeni poslovi. Nije bilo commit-a, push-a ni javne objave.
