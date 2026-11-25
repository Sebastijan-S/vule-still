type Location = { id: string; slug: string };

// Only locations already filtered as active/bookable by the server enter this list.
export function bookingNavigation(locations: Location[], requestedSlug?: string, savedLocation?: string) {
  const firstStep = locations.length === 1 ? 1 : 0;
  const location = locations.length === 1 ? locations[0].id
    : locations.find(l => l.slug === requestedSlug)?.id ?? locations.find(l => l.id === savedLocation)?.id ?? "";
  return { location, firstStep, steps: [0, 1, 2, 3].filter(step => step >= firstStep) };
}
