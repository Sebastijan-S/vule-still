# Vule Still — plan nove aplikacije

Datum: 31.10.2026. Verzija dokumentacije: 1.0, pripremljena za pregled.

Osnova su korisnikov opis, screenshotovi i odgovori na 43 pitanja, uz kasnije odluke o bazi. Kasniji odgovori imaju prednost nad ranijim. Next.js temelj i početne Supabase tabele su postavljeni; poslovne funkcionalnosti i prijava još nisu završeni.

| Dokument | Sadržaj |
| --- | --- |
| [PRD](PRD.md) | Funkcionalnosti, ekrani, pravila rezervisanja i kriterijumi prihvatanja |
| [SoW i plan realizacije](SOW.md) | Isporuke, faze, predlog arhitekture, troškovi, zavisnosti i provere |
| [Registar odluka](ODLUKE.md) | Svih 43 odgovora, razrešene promene i predložena tumačenja detalja |

## Dogovorena osnova

- Vule Still; izgled blizak dostavljenim screenshotovima, prvenstveno za telefon.
- Nova Next.js + TypeScript aplikacija, Supabase baza i Auth, početak sa praznom bazom.
- Jedan frizer, Zrenjanin i Neuzin; zajednička provera njegove zauzetosti.
- Jedna usluga po rezervaciji; standardne 20, premium 40 minuta.
- Nedeljni raspored postaje dostupan korisnicima tek kada ga vlasnik objavi.
- Imejl se šalje samo za kod za prijavu. Potvrde i promene rezervacija prikazuju se u aplikaciji.
- Hosting bez mesečne pretplate koji dozvoljava komercijalnu upotrebu; domen se kupuje posebno.

## Predlog infrastrukture

GitHub za kod, Netlify Free za hosting, Supabase Free za bazu/prijavu i Resend Free kao SMTP servis samo za kodove. Ovo je predlog za realizaciju, a ne tvrdnja da su nalozi otvoreni ili povezani. Limiti i izvori su navedeni u SoW-u.

## Trenutno stanje i sledeći korak

Next.js aplikacija je u `vule-still/`. Naknadne odluke o bazi upisane su u [registar odluka](ODLUKE.md). Početnih pet tabela i početni podaci primenjeni su 01.11.2026. na potvrđen cloud projekat, a Next.js Supabase klijenti su podešeni. Stvarni javni API je proveren bez upisa test korisnika. Detalji: [Supabase uputstvo](../vule-still/supabase/README.md) i [zapisnik primene](../vule-still/supabase/DEPLOYMENT.md).

Sledeće je implementacija prijave/registracije kodom i profila, sa odvojenim razvojnim proverama Auth-a, prava i neaktivnosti. Stari `outputs/vule-style/`, pomenut u prvobitnom planu, nije prisutan u ovom radnom folderu; reference su dostupne u `reference/screenshots/`.

Supabase projekat i početni admin mejl su dostavljeni. Pre stvarnog javnog slanja kodova potreban je podešen servis sa verifikovanim domenom pošiljaoca. Tačni javni kontakti i datum puštanja u rad još nisu dostavljeni. Tajni ključevi se unose u podešavanja okruženja, ne u dokumentaciju ili Git.
