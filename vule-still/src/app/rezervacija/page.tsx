import Link from "next/link";
import { Icon } from "@/components/icon";

export default function BookingPreview() {
  return <main id="main" className="container booking-preview"><p className="eyebrow">REZERVACIJE</p><h1>Zakazivanje <em>uskoro.</em></h1><p>Usluge i lokacije možeš da pregledaš na početnoj strani. Izbor termina i potvrda rezervacije još nisu dostupni.</p><div className="booking-preview-actions"><Link href="/#usluge" className="button">Pogledaj usluge <Icon name="arrow" /></Link><Link href="/#lokacije" className="outline-link">Pogledaj lokacije <Icon name="arrow" /></Link></div></main>;
}
