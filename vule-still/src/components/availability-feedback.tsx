"use client";

const messages: Record<string, [string, string]> = {
  unpublished: ["Raspored još nije objavljen.", "Izaberi drugi datum ili proveri ponovo kada vlasnik objavi nedelju."],
  closed: ["Ovaj dan je neradan.", "Izaberi drugi datum za svoj dolazak."],
  fully_booked: ["Svi odgovarajući termini su zauzeti.", "Izaberi drugi datum za svoj dolazak."],
  insufficient_duration: ["Nema dovoljno dugog slobodnog perioda za izabrane usluge.", "Izaberi drugi datum ili promeni usluge da ceo dolazak stane u jedan slobodan period."],
  cutoff: ["Za danas više nema termina koji počinju najmanje 15 minuta unapred.", "Izaberi drugi datum za svoj dolazak."],
  outside_horizon: ["Datum je van perioda za zakazivanje.", "Izaberi datum u narednih 14 dana."],
};

export function AvailabilityFeedback({ reason, failed, loading, onRetry, onDate, onServices }: {
  reason?: string; failed: boolean; loading: boolean; onRetry: () => void; onDate: () => void; onServices?: () => void;
}) {
  if (loading) return <p role="status">Proveravamo slobodne termine…</p>;
  const message = reason ? messages[reason] : undefined;
  if (failed || !message) return <div className="availability-feedback">
    <p role="alert" className="form-error">Ne možemo da proverimo slobodne termine. Proveri vezu i pokušaj ponovo. Tvoj izbor je sačuvan.</p>
    <button type="button" className="outline-link" onClick={onRetry}>Pokušaj ponovo</button>
  </div>;
  return <div className="booking-empty availability-feedback" role="status">
    <p>{message[0]}</p><p>{reason === "insufficient_duration" && !onServices ? "Izaberi drugi datum da ceo dolazak stane u jedan slobodan period. Sastav potvrđenog dolaska ostaje isti." : message[1]}</p>
    <div className="booking-toolbar"><button type="button" className="outline-link" onClick={onDate}>Izaberi drugi datum</button>
      {reason === "insufficient_duration" && onServices && <button type="button" className="text-button" onClick={onServices}>Promeni usluge</button>}
      {reason === "unpublished" && <button type="button" className="text-button" onClick={onRetry}>Proveri ponovo</button>}
    </div>
  </div>;
}
