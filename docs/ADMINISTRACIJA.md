# Vule Still — kratko uputstvo za vlasnika

Lokalni testni ulaz: **http://127.0.0.1:3100/administrator**. Otvori u Google Chrome-u. Sajt i administracija koriste isti lokalni server i test projekat Vule-still-test. Na konačnom domenu ulaz će imati istu putanju `/administrator`; produkcija još nije objavljena.

Prijavi se postojećim vlasničkim nalogom. Važi trenutna testna prijava imejlom i lozinkom. Registracija običnog naloga i poznavanje direktnog linka ne daju vlasnička prava. Vlasništvo se proverava na serveru i u bazi; dodela ili prenos vlasništva nisu samostalna registracija. Telefon + lozinka ostaje zaseban završni posao.

Administratorsko zaglavlje ima tri odeljka, bez javnih sekcija sajta:

1. **Rezervacije:** odaberi datum, dan ili sedam dana od tog datuma. „Danas“/„Sutra“ ubrzavaju izbor. Filtriraj po lokaciji i statusu. Kartica pokazuje vreme, lokaciju, osobu, telefon i status; „Detalji i kontakt“ otvara dodatne podatke. Jedan frizer je zajednički za obe lokacije.
2. **Radno vreme:** dva kalendara konkretne nedelje, Zrenjanin i Neuzin. Na telefonu prevuci sam kalendar vodoravno. Klikni smenu za izmenu ili **+** u zaglavlju dana za dodavanje rada. Ovo otvara radno vreme, ne pravi rezervaciju klijenta.
3. **Uobičajena nedelja:** izmeni podrazumevane smene, pauze i razmak za buduće nacrte. Podržani su svi dani, uključujući nedelju. Šablon ima jednu smenu po lokaciji i danu; više konkretnih smena dodaje se u kalendaru nedelje.

## Ručni klijent, pomeranje i otkazivanje

Korak 2 je pripremio bazu i API za više usluga u jednom dolasku. Takav termin na kartici prikazuje sve stavke, pojedinačna trajanja i ukupan broj minuta; pri pomeranju koristi sačuvano ukupno trajanje. Izmena vremena i otkazivanje važe za ceo dolazak. Za promenu sastava otkaži termin i napravi novi. Sama forma za novi ručni unos i dalje bira jednu uslugu; više izbora uključuje se u koraku 3.

Od 25.11.2026. za novo zakazivanje dostupne su četiri standardne usluge. Tri premium usluge su privremeno povučene, a ranije potvrđeni premium termini ostaju u pregledu sa sačuvanim nazivom i trajanjem. Mogu se pomerati i redovno otkazivati po istim pravilima. Povlačenje usluge ne otkazuje postojeći termin.

- **Dodaj ručni termin:** dovoljno je ime osobe; telefon je opcion. Izaberi lokaciju, jednu uslugu, datum i ponuđeni slobodni termin, pa potvrdi. Gostu se ne otvara nalog i nema obaveštenje u aplikaciji. Bez telefona nema kontakta za poziv.
- **Izmeni termin:** na kartici promeni datum, lokaciju i slobodno vreme. Moguće je pomeranje na sledeći ili drugi dozvoljeni dan. Ime osobe i kontakt gosta mogu se izmeniti; povezani korisnik koristi trenutni telefon iz profila. Sačuvana usluga i trajanje ostaju isti. Za promenu usluge koristi otkazivanje i novi unos.
- Neuspešno pomeranje čuva prethodni termin. Ako se izabrani termin u međuvremenu zauzme, osveži slobodne termine i izaberi drugi.
- **Otkaži termin:** potvrdi prikazanu radnju. Odustajanje u potvrdi ne menja rezervaciju. Za redovnu izmenu i otkazivanje mora ostati najmanje 30 minuta do starog početka. Novi početak mora biti najmanje 15 minuta u budućnosti, unutar objavljenog rada i horizonta do danas + 14 dana uključivo.
- Povezani korisnik dobija trajnu promenu/otkazivanje u aplikaciji kada je otvori. Nema booking mejlova, SMS-a, push poruka ili podsetnika. Ručni gost nema tu dostavu.
- Ako ishod mrežnog zahteva nije poznat, upotrebi **Proveri isti zahtev** pre nove operacije. Time se izbegava dupli unos.

## Smene, pauze, slobodni i neradni dani

Izaberi nedelju u **Radno vreme**. Ako još ne postoji, „Pripremi nedelju“ pravi nacrt iz trenutno sačuvane uobičajene nedelje. Za rad nedeljom pritisni **+** u koloni „Ned“, izaberi radno vreme i po potrebi pauze. Za neradan dan ukloni sve njegove smene na obe lokacije. Prazan dan predstavlja neradan dan ili odsustvo.

**Sačuvaj nacrt** čuva izmenu obe lokacije; korisnicima i dalje važi prethodno objavljen raspored. Tek **Objavi nedelju** otvara raspoložive termine. „Nacrt“/„Objavljeno“ služe za poređenje. Razmak između lokacija je podrazumevano 60 minuta i može se promeniti, uključujući 0, uz proveru zajedničkog frizera.

Ako bi objava ugrozila postojeću rezervaciju, biće odbijena bez otkazivanja i bez izmene aktivnog objavljenog rasporeda. Najpre pojedinačno pomeri ili redovno otkaži pogođenu rezervaciju, pa ponovi objavu. Nema izuzetka za kasno ili grupno otkazivanje.

## Promena uobičajene nedelje

U **Uobičajena nedelja** izmeni željeni dan/lokaciju, dodaj pauzu ili ukloni smenu za neradan dan, pa pritisni **Sačuvaj uobičajenu nedelju**. Ta promena važi samo za nedelje koje tek prvi put pripremiš. **Postojeći nacrti i objavljene nedelje ostaju nepromenjeni.** Njih po potrebi zasebno izmeni u **Radno vreme**, sačuvaj i objavi. Druga otvorena sesija ne može tiho prepisati noviju verziju šablona.

## Šta pregledati

Na telefonu i računaru proveri zaseban ulaz i navigaciju, dnevni/sedmodnevni pregled, ručni unos samo sa imenom, pomeranje na drugi datum, potvrdu otkazivanja, nedeljnu smenu/pauzu i razliku između šablona, nacrta i objave. Korisničko prihvatanje još nije evidentirano.

Rezultati automatizovanih i stvarnih provera: [rezultati](../vule-still/supabase/tests/RESULTS.md). Stanje i predaja: [plan faza](../PHASE_PLAN.md). Faza 11, završni Auth i produkciona aktivacija ostaju odvojeni poslovi. Nije bilo commit-a, push-a ni javne objave.
