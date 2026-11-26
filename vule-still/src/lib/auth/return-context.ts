// The caller supplies a destination already checked by safeReturnTo/accountReturnTo.
export function returnContext(next: string) {
  const booking = next.split(/[?#]/, 1)[0] === "/rezervacija";
  return {
    booking,
    href: booking ? next : "/moji-termini",
    label: booking ? "Nazad na rezervaciju" : "Nazad na Moje termine",
  };
}
