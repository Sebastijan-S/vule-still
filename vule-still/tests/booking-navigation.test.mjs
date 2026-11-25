import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingNavigation } from "../src/lib/booking-navigation.ts";
const neuzin = { id: "neuzin-id", slug: "neuzin" }, zr = { id: "zr-id", slug: "zrenjanin" };
test("single bookable location bypasses location step, including obsolete links/drafts", () => {
  assert.deepEqual(bookingNavigation([neuzin], "zrenjanin", zr.id), {location: neuzin.id, firstStep: 1, steps: [1,2,3]});
});
test("activating second location restores full navigation and requires an initial choice", () => {
  assert.deepEqual(bookingNavigation([neuzin,zr]), {location: "", firstStep: 0, steps: [0,1,2,3]});
});
test("second-location direct link and saved choice remain available", () => {
  assert.equal(bookingNavigation([neuzin,zr], zr.slug).location, zr.id);
  assert.equal(bookingNavigation([neuzin,zr], undefined, zr.id).location, zr.id);
});
test("explicit location takes precedence while withdrawn locations are not restored", () => {
  assert.equal(bookingNavigation([neuzin,zr], neuzin.slug, zr.id).location, neuzin.id);
  assert.equal(bookingNavigation([neuzin,zr], "withdrawn", "withdrawn-id").location, "");
});
test("empty bookable catalogue keeps location step without inventing a location", () => {
  assert.deepEqual(bookingNavigation([], neuzin.slug, neuzin.id), {location:"",firstStep:0,steps:[0,1,2,3]});
});
