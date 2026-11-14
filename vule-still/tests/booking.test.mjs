import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConfirmation,parseCancellation,bookingFailure } from "../src/lib/booking.ts";
const uuid="73000000-0000-4000-8000-000000000001";
const valid={request_key:uuid,location:uuid,service:uuid,start:"2026-11-04T09:00:00.000Z",schedule_revision:1,expected_service_name:"Test",expected_duration:20};
test("confirmation only accepts the public selection contract, not client authority",()=>{
  assert.deepEqual(parseConfirmation({...valid,user_id:uuid,duration_minutes:1,booking_blocked:false}),{...valid,attendee_name:null});
  assert.equal(parseConfirmation({...valid,attendee_name:"  Druga osoba  "}).attendee_name,"Druga osoba");
});
test("invalid dates, ids, revisions, seconds and names are rejected",()=>{
  for(const change of [{request_key:"invalid"},{location:null},{service:[]},{start:"2026-02-30T09:00:00.000Z"},{start:"2026-11-04T09:00:30.000Z"},{schedule_revision:0},{schedule_revision:1.5},{attendee_name:" "},{attendee_name:"x".repeat(121)},{attendee_name:{}}]) assert.equal(parseConfirmation({...valid,...change}),null);
  for(const value of [null,[],"",{}]) assert.equal(parseConfirmation(value),null);
});
test("cancellation accepts only identifiers, never supplied account authority",()=>{
  assert.deepEqual(parseCancellation({request_key:uuid,reservation:uuid,user_id:"forged"}),{request_key:uuid,reservation:uuid});
  assert.equal(parseCancellation({request_key:uuid,reservation:"invalid"}),null);
});
test("booking conflicts, access and unknown outcomes have distinct safe responses",()=>{
  assert.equal(bookingFailure("SLOT_TAKEN").status,409);
  assert.equal(bookingFailure("SESSION_REQUIRED").status,401);
  assert.equal(bookingFailure("BOOKING_BLOCKED").status,403);
  assert.equal(bookingFailure("PROFILE_REQUIRED").status,422);
  assert.equal(bookingFailure("RESERVATION_NOT_FOUND").status,404);
  assert.equal(bookingFailure("CANCELLATION_TOO_LATE").status,409);
  assert.equal(bookingFailure("database private details").status,503);
  assert.equal(bookingFailure("database private details").error.includes("private details"),false);
});
