import { useId } from "react";
import { offsetLabel, timeLabel } from "@/lib/appointment-display";

type Slot = { start: string; end: string; local_start: string };

export function SlotPicker({ slots, selected, onChange, label = "Slobodni termini" }: { slots: Slot[]; selected: string; onChange: (start: string) => void; label?: string }) {
  const group = useId();
  return <fieldset className="slot-picker"><legend>{label}</legend><div className="slot-options">{slots.map(slot => <label className="slot-option" key={slot.start}>
    <input type="radio" name={group} value={slot.start} checked={selected === slot.start} onChange={() => onChange(slot.start)} aria-label={`${slot.local_start}–${timeLabel(slot.end)} (${offsetLabel(slot.start)})`} />
    <span>{slot.local_start}<small>{offsetLabel(slot.start)}</small></span>
  </label>)}</div></fieldset>;
}
