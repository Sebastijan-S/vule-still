# Vule Still — implementation plan for 12 chats

Created: 1 November 2026. Updated: 3 November 2026. Living implementation plan and phase handoff.

## Current direction — supersedes older handoffs

- The user accepted the existing account, inactivity and public website work on 2 November and requested completion of scheduling and phase 6. The editor must use **two weekly calendars**, one for Zrenjanin and one for Neuzin.
- Finish the full website on temporary **Vule-still-test** (`xfbjgxtgvlyndonhlupm`) using email + password **without email delivery or email verification for now**. Missing domain/SMTP must not block phases 3–11.
- Phase 2 now covers the isolated development environment and working password Auth. Real email confirmation, delivery, recovery, sender/domain settings and genuine production-owner verification are explicitly moved to **phase 12**, after the domain and final business details are supplied. This changes the phase boundary; no successful email test is claimed.
- A synthetic test owner is permitted only in the disposable test project. It is not production ownership or proof of control of its email address. Keep RLS and the separate owner-membership check. Keep the real [owner bootstrap](./vule-still/supabase/scripts/bootstrap_admin.sql) for genuinely verified production ownership in phase 12.
- Default local production configuration still points to `usokysukvtgtvrtxnjai`; use the ignored test environment for all current previews/builds/tests. Do not apply development fixtures to production.
- The user authorized a commit and normal Git push to `https://github.com/Sebastijan-S/vule-still.git` on 3 November for a recovery checkpoint. This is a source-code backup; it does not authorize production database changes or a public website deployment.
- Read the latest handoff below before starting the next chat. Older dated handoffs remain historical evidence and do not reintroduce the email prerequisite.

## Start here

Open the same Vule Still workspace in a new chat and say:

> Read PHASE_PLAN.md and its latest handoff, then start phase 7 on Vule-still-test. Keep temporary password authentication without email verification; final email setup belongs to phase 12. Work only on phase 7, verify the result, update the handoff, and tell me what to review.

In this document, **phase numbers 1–12 are the chat numbers**. They divide the previously recommended nine website stages into smaller pieces. Use these numbers for commands such as “Start phase 2”; the original stage mapping is in the table below. The older F0–F7 labels in the SoW describe broader milestones and are not these chat numbers.

**Respect the selected mode and the user's current request.** In Plan mode, inspect and plan only. Do not implement the website, install dependencies, change Git history, or modify cloud services. Creating or editing a planning document is allowed when specifically requested. A request to create a repository or write this plan does not authorize application implementation. If implementation is requested while Plan mode remains active, explain that implementation should start after the user switches mode; do not silently proceed.

In an implementation chat, “Start phase N” selects only that phase's scope. Complete the authorized work and its checks, then stop at its review checkpoint. Do not automatically begin the next phase or create another chat.

## Project identity and sources

- Workspace and Git root: `C:/Users/Cebo/Documents/Vule Still`.
- Next.js application: [vule-still/](./vule-still/).
- Only GitHub destination for this project: [Sebastijan-S/vule-still](https://github.com/Sebastijan-S/vule-still), remote `https://github.com/Sebastijan-S/vule-still.git`.
- Main branch: `main`. Do not operate on SN Ingenia or any other repository.
- Business requirements: [PRD](./docs/PRD.md), [decisions](./docs/ODLUKE.md), [SoW](./docs/SOW.md).
- Visual references: [four screenshots](./reference/screenshots/); approved source assets: [assets/](./assets/).
- Application instructions: [AGENTS.md](./vule-still/AGENTS.md). Read the installed Next.js guides it names before coding.
- Database context: [Supabase README](./vule-still/supabase/README.md), [deployment record](./vule-still/supabase/DEPLOYMENT.md), [migrations](./vule-still/supabase/migrations/), [SQL test results](./vule-still/supabase/tests/RESULTS.md).

Latest explicit user decisions take precedence over earlier documentation. This plan divides delivery work; it does not change agreed business rules. Do not ask the user to repeat decisions already recorded in the source documents.

## Historical starting state — 1 November 2026

The following bullets describe the original baseline. Current statuses are in the phase table and latest handoff, not in this historical inventory.

- The accepted foundation is commit `5745e59`, with tag `checkpoint/00-foundation`, pushed to the new GitHub repository on `main`.
- Current local branch when this plan was written: `phase/01-auth`.
- **Unfinished authentication and presentation edits already exist locally. They are uncommitted, unpushed and not approved.** Their presence does not mean phase 1 is complete or its visual design is accepted.
- Existing changes include the application manifest/lockfile, global styling, layout and home page, plus new brand assets, authentication/profile/account routes, components and auth helpers. The phone validation dependency was installed. Inspect the actual diff before deciding what to reuse.
- When phase 1 implementation is explicitly started outside Plan mode, first show a brief inventory, inspect the draft as unapproved work, and reuse/rework only the portions needed for phase 1. Do not assume its design is accepted, delete/reset the draft wholesale, or include unrelated work in a phase commit. Ask only if ownership or conflicting edits make a safe continuation unclear.
- Supabase project `usokysukvtgtvrtxnjai` is reserved for future production. Its existing five public tables and three foundation migrations were verified. There were two locations, one shared barber resource, seven services, and no Auth users or admin memberships at the review time.
- The review passed 45 isolated SQL checks and the live read-only public API check. Anonymous access to private tables was rejected. Security and performance advisors returned no findings. These results are dated evidence, not proof that later changes are correct.
- Real OTP delivery, authenticated browser flows and the account-wide inactivity requirement have not been verified. No separate development Auth project or sending domain was confirmed in this conversation.
- The initial foundation build was previously reported successful. The later draft build did **not** finish: it encountered cache permissions and a locked `.next/local-dev.stderr.log`. A Vule Still development process was present. Identify current project-owned processes before restarting anything; do not stop arbitrary Node processes or delete a running build cache. Store future server logs outside the build output.
- This new plan is initially local only. No application changes, cleanup, commit or push are part of writing it.

## Shared rules for every phase

### Scope and design

- Rebuild the same Vule Still website with Next.js, TypeScript and Supabase. Reuse the supplied brand assets and confirmed content; do not migrate old application code or customer data.
- Match the references: nearly black backgrounds, light text, red accents, Manrope typography, italic serif heading accents, thin borders, restrained corner rounding and generous spacing. Do not replace this with an unrelated design or repeat a grayscale discovery stage.
- The screenshots cover the homepage and logged-out “Moji termini”; they do not include the email-code form. Extend the existing visual language for missing screens and obtain visual review.
- The application is Serbian Latin, primarily for phones. Check at 360, 390 and 1280 px. Include keyboard focus, labels, readable errors, loading states and touch targets around 44 px or larger.
- The screenshots guide appearance. Where old screenshot content conflicts with confirmed rules, use the rules: standard services initially 20 minutes, premium 40, and the agreed Monday–Saturday template.
- One barber serves Zrenjanin and Neuzin. One concrete service per booking. No prices, online payments, SMS, push, booking emails or scheduled reminders. Only authentication sends email.
- Keep existing accepted work intact. Refactor shared code only when necessary for the selected phase and include the impact in verification.

### Environments and verification

- No Docker installation. Use isolated in-memory SQL checks where appropriate, and a separate real development Supabase environment for Auth/API and concurrent integration tests.
- Never insert synthetic users, bookings or failure-test data into the production project. Development fixtures must be visibly identified and isolated from runtime production data.
- Do not disable RLS, rate limiting or other security checks to make tests pass. The user's current decision permits `Confirm email` to remain off **only** in Vule-still-test throughout website implementation and permits an explicitly provisioned synthetic test owner there. These accounts do not prove email ownership. Restore confirmation, test email + password registration and provision the real owner in phase 12 before public release.
- Keep secrets out of source, Git, screenshots, command output and handoffs. A publishable key may be used in application clients; privileged keys must never reach the browser.
- Use new migrations for schema changes. Read current database objects before changing them. Track schema, Auth/SMTP configuration and code as separate change sets.
- Missing external prerequisites must be reported precisely. Finish independent work, but do not claim an untested external flow works or silently mark a blocked phase complete.
- Paid services/branches, purchases, production migrations, live deployment and real messages require applicable user authorization. Do not infer it from this plan or approval of a visual design. Use a specifically authorized test recipient for real email verification.

### Git checkpoints and phase handoff

1. Read this file and its latest handoff. Verify repository root, remote, branch and working tree. Identify unfinished work before editing.
2. Use one branch per chat phase, based on the last accepted checkpoint. For phase 1, the existing `phase/01-auth` branch may be reused after inspecting its draft. Do not switch away from dirty work or reset it to manufacture a clean start.
3. Implement only the selected scope and run relevant checks. Run the production build for application changes. Run database tests when migrations/permissions change. Record exact commands and outcomes.
4. Present a working preview for interface phases, a concise result summary, and a small manual review checklist. Clearly separate passed automated checks from checks the user still needs to perform.
5. Mark **Ready for review** only when that phase's own required checks pass. Missing checks explicitly deferred to a later phase must be named. Do not equate “compiles” with “complete”.
6. After the user accepts the phase, save its changes and handoff as a phase commit and tag when authorized. Suggested tags are `checkpoint/01-auth`, `checkpoint/02-auth-delivery`, etc. Record the real commit/tag, not a planned or invented one. Mark acceptance only from an actual user response.
7. Fetch before an authorized push or integration. Push/merge only to this repository within the user's applicable authorization. Do not force push or assume that a previous baseline push request authorizes every later publication. Keep `main` as the accepted baseline.
8. Finish with the next phase number and the exact next-chat prompt. If review, a fix, or an external input is pending, name that action first and make the next phase conditional on it. Do not start the next phase yourself.

Git checkpoints restore code. Database changes and external settings need their own recovery procedure. Prefer additive, compatible migrations; record what an application rollback requires. Before production data changes, make and verify the appropriate backup/export. Do not automatically undo schema or erase data when reverting a visual change.

## Phase map and progress

Status values: **Not started**, **In progress**, **Ready for review**, **Completed / Accepted**, **Blocked**. Completion refers to the current agreed phase scope. Deferred release checks must remain explicit. User acceptance of earlier work is recorded; phase 6's new interface still has its manual review checklist.

| Chat phase | Original website stage | Scope | Status | Source checkpoint |
| --- | --- | --- | --- | --- |
| 1 | 1 — Authentication | Login, registration, logout and profile | Completed / Accepted; temporary password mode | checkpoint/06-availability |
| 2 | 2 — Auth readiness, part A | Isolated test environment and no-email password Auth | Completed; real email confirmation moved to phase 12 | checkpoint/06-availability |
| 3 | 2 — Auth readiness, part B | Account inactivity, access and test-owner provisioning | Completed / Accepted for test scope; real owner verification in phase 12 | checkpoint/06-availability |
| 4 | 3 — Public website | Complete public design and content | Completed / Accepted; final real contacts in phase 12 | checkpoint/06-availability |
| 5 | 4 — Scheduling | Published schedules and two location calendars | Completed on test project; manual calendar review at handoff | checkpoint/06-availability |
| 6 | 5 — Booking engine, part A | Availability and time rules | Completed; advisory API, reservation writes remain closed | checkpoint/06-availability |
| 7 | 5 — Booking engine, part B | Atomic reservations, permissions and concurrency | Not started | — |
| 8 | 6 — Booking interface | Customer booking journey | Not started | — |
| 9 | 7 — Customer account | My appointments, cancellation and notifications | Not started | — |
| 10 | 8 — Administration, part A | Calendar and manual reservation management | Not started | — |
| 11 | 8 — Administration, part B | Blocking, services, exceptional changes and audit | Not started | — |
| 12 | 9 — Verification and launch | Final email confirmation, domain, real owner, integration checks and launch preparation | Not started; external details intentionally deferred | — |

## Phase 1 — Login, registration, logout and profile

**Outcome:** a coherent, reviewable account journey in the reference style. This is local application functionality; public email delivery and the custom inactivity rule have separate gates in phases 2 and 3.

**Before work:** inspect the existing auth draft, identify what can be reused/reworked for phase 1 and preserve unrelated work. Do not discard it wholesale without instruction. Verify the baseline and current environment. Review all four screenshots visually. Follow the installed Next.js guidance, especially cookies, Server Actions and Cache Components.

**Implement:**

- Shared account-page styling and only the shell needed for authentication. Keep full homepage reconstruction in phase 4.
- Current implementation uses email + password on the isolated test project with confirmation disabled. Supabase Auth owns credentials and sessions; no custom password table. Real email confirmation is phase 12. The older OTP code path is historical and must not be mistaken for the final chosen flow.
- Loading/error states, wrong or expired codes, changing email, resend countdown and safe retry behavior. A countdown is only UI feedback; provider/server limits remain authoritative.
- Correct browser/server Supabase clients, session refresh cookies, server-side identity verification and protected account routes. Prevent external or unsafe return URLs.
- New-user profile completion after verification; editable first name, surname and Serbian/international phone, plus read-only verified email. Normalize phone input before saving. Never accept a client-supplied user ID or admin role as authority.
- Explicit logout of the current device/session, removal of its session state and refreshed navigation. Another device's activity must not log it back in.
- A return-destination contract for the later booking journey. Do not implement a fake booking or claim a saved selection reserves a slot.

**Checks:** invalid email; wrong/expired/reused code behavior; resend UI and error handling; profile validation; reload/back behavior; protected access while logged out; logout and subsequent protected-page access; open-redirect attempts; mobile and keyboard flow. Test isolated scenarios using fixtures if real development Auth is unavailable, and label simulated evidence clearly. Real provider delivery verification belongs to phase 2; the complete booking return journey belongs to phase 8.

**Review checkpoint:** show email entry, code entry, profile, logged-out account page and logout result at mobile/desktop sizes. State exactly which real Auth paths remain untested. Do not claim PRD A01/A02/A09/A16 are fully satisfied yet.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 2.`

## Phase 2 — Development Supabase and temporary password Auth

**Outcome:** repeatable, isolated verification of account functionality against real Supabase Auth without sending email. This scope is complete; all actual email configuration and delivery checks below are moved to phase 12.

**Prerequisites:** phase 1 code and separately confirmed development project. Use `Vule-still-test`; its temporary `Confirm email` setting is off. No sender domain, SMTP or test email recipient is needed for the current scope. Do not buy a domain, create a paid branch, or use production as a substitute.

**Implement/configure:**

- Reproduce the foundation schema in development using versioned migrations; keep environment credentials separate and ignored by Git. Document how to identify the active environment without exposing secrets.
- Keep provider-managed email + password sign-up/sign-in in a test-project-only mode; verify sessions, own profile access/update and denial of another account's data without sending mail.
- Move SMTP, sender domain, confirmation/recovery templates, final Auth URLs, redirect allowlist, abuse controls and real delivery/failure/resend checks to phase 12. The public flow is email + password + email confirmation, not the earlier OTP-only proposal.
- Keep configuration instructions and an environment/template checklist with the project; configuration outside SQL migrations must also be reproducible.

**Checks:** new and returning synthetic password account, automatic private profile creation, authenticated own-profile reads/updates, cross-account denial, independent device sessions and local logout. No email is sent. Final confirmation/recovery and client-bundle secret review remain phase 12 requirements.

**Review checkpoint:** report authenticated test API evidence separately from isolated fixtures. Missing SMTP/domain is an intentional phase 12 deferral and does not block website implementation. Temporary Auth is not public-release readiness.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 3.`

## Phase 3 — Account inactivity, session security and administrator

**Outcome:** the agreed account-wide 30-day rule protects server routes and database access, and one synthetic test owner can exercise administration. Genuine production-owner verification is phase 12.

**Prerequisites:** real development Auth/API from phase 2. Read the account-activity proposal in the SoW and inspect actual Supabase session/token behavior before choosing the implementation.

**Implement:**

- Versioned account activity/session access state with narrowly scoped database operations and permission checks. Derive identity/session proof from verified Auth data, not caller-supplied IDs or user-editable metadata.
- Actual authenticated user activity on any device keeps the account active across devices. Background token refresh and automatic prefetch must not count as user activity.
- At 30 days of account inactivity, reject old access before recording any new activity. Fresh authentication grants fresh permitted access; it must not silently restore other expired sessions.
- Enforce the same decision through RLS/controlled database functions and server handlers. Custom session tables themselves must not be directly writable to bypass expiry.
- Keep explicit local logout effective. Account blocking later must still allow login/history, so do not confuse a booking ban with an Auth ban.
- In Vule-still-test only, provision a clearly synthetic owner through a privileged, controlled operation with a guard against replacing another owner. Never expose self-assignment to ordinary customers. Use the existing production bootstrap only after real email verification in phase 12. Owner administration does not require a completed customer profile.

**Checks:** active phone keeps desktop active; no activity for exactly 30 days and either side of that boundary; background refresh does not extend activity; stale direct API tokens fail; one new login does not revive other old sessions; local logout persists; forged metadata/IDs/role writes fail; ordinary and unverified accounts cannot exercise owner access. Use controllable development timestamps, not a real 30-day wait.

**Review checkpoint:** demonstrate the two-device scenarios and direct API denial, with tests for the underlying database policies. Resolve any architectural failure before booking work. This phase completes the substantive A16 checks and the account/owner portion of access protection.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 4.`

## Phase 4 — Complete public website in the reference design

**Outcome:** the full public presentation matches the supplied design and uses confirmed Supabase catalogue data.

**Prerequisites:** accepted account design and routes. Inspect screenshots and assets again; preserve accepted authentication components.

**Implement:**

- Header/navigation, hero image and typography, service section, premium service accordion, two location cards, final booking call to action and footer.
- Centralized brand/location content and active services from Supabase, including correct order and 20/40-minute starting durations. Premium is a category containing individual services.
- Logged-in/logged-out navigation, responsive layouts, keyboard interactions, accessible labels and image handling.
- Basic metadata, correct brand icons and useful loading/error states. Retain the supplied logo and hero rather than replacing them with generated alternatives.
- Before phase 8, booking entry points should have a clear interim destination/state instead of dead links or a fake successful booking. Record exactly which links phase 8 will connect.
- Show real contact details only when supplied; otherwise clearly label prototype examples or omit them. Weekly templates must not be presented as guaranteed published availability.

**Checks:** screenshot comparison at 360/390/1280 px; no horizontal overflow; all current navigation works; premium expansion works with keyboard; assets load; no console errors or private catalogue fields; authentication still works. Check visible text and controls for readable contrast.

**Review checkpoint:** user reviews the complete public page against the references. Fix visual differences before accepting this phase. Booking functionality remains outside this phase.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 5.`

## Phase 5 — Schedule data and basic owner editor

**Outcome:** the owner can prepare and publish a real weekly schedule for the one shared barber.

**Prerequisites:** secure owner access and development environment. Re-read the exact scheduling rules and record the mutation/versioning contract that bookings will share.

**Implement:**

- Versioned migrations for weekly templates, week drafts/published revisions, shifts, breaks and scheduling settings. A day without a shift represents a day off/absence; no separate absence-reason entity is claimed.
- The starting Monday–Saturday template: Zrenjanin 10:00–15:00; Neuzin 17:00–20:00; Sunday closed. Templates prepare weeks; they do not publish them automatically.
- Two weekly time-grid calendars, Zrenjanin and Neuzin, with a shared week selector, editable shifts, multiple breaks, days off and explicit publication. Support current and future weeks, draft/published preview, keyboard editing and local horizontal scrolling on small screens.
- One barber across both locations; disallow conflicting shifts. Default inter-location travel gap is 60 minutes, configurable to another nonnegative value including zero.
- Server/database validation, owner-only writes, revision checks and a consistent locking strategy for future concurrent booking/schedule operations. Public APIs expose only published schedule facts needed for availability.
- Preserve the active published revision while editing a draft. Define a safe contract for affected-booking previews; destructive schedule changes must not bypass later reservation checks once phase 7 introduces bookings.

**Checks:** unpublished weeks have no public availability; draft edits do not alter the published version; overlapping/cross-location shifts fail; invalid breaks fail; travel-gap boundaries; week/date/timezone boundaries; only the owner can publish; simultaneous edits cannot silently overwrite a newer revision.

**Review checkpoint:** publish a test week in development and show its draft/published behavior. Detailed booking-impact management comes in phase 11; the required shared database safety must be integrated before phase 7 enables booking writes.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 6.`

## Phase 6 — Availability and time rules

**Outcome:** a tested availability service computes bookable start times from published data, without exposing customer information.

**Prerequisites:** phase 5 schedule model. All business rules use `Europe/Belgrade`; do not hardcode a UTC offset.

**Implement:**

- Availability for one selected location and one active concrete service using published shifts, breaks, absences, travel rules and occupied intervals for the shared barber.
- Prepare the reservation read contract/minimal schema needed to represent occupied intervals, keeping customer reservation writes closed until phase 7. Use isolated fixtures for occupied periods.
- Entire duration must fit in a free interval. Generate starts in duration-sized steps from each free interval's beginning. The 15-minute cutoff filters that sequence without moving its starting point.
- Dates from today through today + 14 inclusive; starts at least 15 minutes in the future, measured on the server.
- Distinguish unpublished, closed, fully booked, and insufficient-duration states. Return times and availability reasons without customer identities or contacts.

**Checks:** every PRD slot example; 20- and 40-minute services; exact 15-minute and 14-day boundaries; touching intervals; gaps around bookings; inactive services; both locations; device timezone different from Serbia; daylight-saving transitions. Use an injected/testable server clock.

**Review checkpoint:** provide an example/results table and passing time-rule tests. Availability is advisory until phase 7 performs atomic confirmation.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 7.`

## Phase 7 — Atomic booking transactions and access protection

**Outcome:** safe reservation and cancellation operations with database-enforced integrity, ready for the customer UI.

**Prerequisites:** phase 6 availability, phase 3 session authorization and the phase 5 schedule mutation contract. Real concurrent development database/API testing is required; sequential mocks are insufficient.

**Implement:**

- Complete reservation schema, service-name/duration snapshots, status, ownership or manual-guest representation, and idempotency records. Linked customers use their current profile contact; do not snapshot their phone. A manual guest has required name, optional phone and no fake Auth account/email.
- Atomic confirmation that rechecks session access, complete customer profile, booking ban, active service, published revision, time bounds, full duration, conflicts and inter-location rules.
- Database protection against overlapping reservations for the single barber, plus consistent locking/version checks shared with schedule changes. Integrate schedule publish/change safety before enabling reservation writes.
- Per-owner/idempotency-key request handling, including same-key retries and rejection of incompatible reuse. A timed-out successful request must not produce a second reservation when retried.
- Authorized customer cancellation at least 30 minutes before start, including equality at the boundary. No one-step customer rescheduling.
- Notification and audit storage/writes inside the same transaction as relevant booking changes. Their customer interface comes in phase 9, but successful mutations must not omit their durable events.
- RLS and restricted write paths for reservations, notification data and idempotency/audit state. Public availability must never expose personal details. Reserve privileged operation contracts for phases 10–11 without broad direct client writes.

**Checks:** concurrent identical/overlapping requests, cross-location conflicts, repeated keys, response-loss/retry, cancellation boundaries, blocked/incomplete/expired accounts, foreign reservation IDs, direct API bypasses and schedule-publication races. A failed transaction must leave no partial reservation, notification or audit event.

**Review checkpoint:** report actual concurrency evidence and complete the reservation portions of A01/A05–A10/A14. Demonstrate that changing future service duration does not modify existing reservations. Do not begin the booking interface until integrity checks pass.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 8.`

## Phase 8 — Customer booking journey

**Outcome:** the full customer booking flow works on a phone and desktop using the real availability and mutation APIs.

**Prerequisites:** accepted public design and safe booking engine. Reuse the visual system; do not introduce another design style.

**Implement:**

- Location → one concrete service → date/time → final review, with progress, backward navigation and clear selection states.
- Public browsing of availability; authentication and a complete profile are required for confirmation. Preserve appropriate selections through login/profile completion, refresh and back navigation.
- Keep saved selections as a draft only; never present them as a hold. Revalidate them against current services, schedule and availability when resuming.
- Booking for self or another named person; review includes location, service, date, start/end, account email and attendee name.
- Confirmation through phase 7's idempotent transaction; pending states prevent accidental duplicate interactions while server protection remains authoritative.
- Stale-slot conflict recovery that retains still-valid location/service selections. Connect all homepage/location/service booking entry points from phase 4.

**Checks:** complete anonymous-to-confirmed journey; returning user; incomplete profile; second-person booking; refresh/back; schedule/service change during login; two customers choosing one slot; connection interruption/retry; empty states; keyboard and 360/390/1280 px layouts.

**Review checkpoint:** user walks through a test booking in development. Confirm stored data and success state match; no real bookings or booking emails are created in production. Complete the end-to-end return-selection portion of A02.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 9.`

## Phase 9 — My appointments, cancellation and notifications

**Outcome:** customers can reliably review their bookings, cancel eligible appointments and read persistent changes.

**Prerequisites:** phase 8 bookings and transactional notification records from phase 7. Match the supplied “Moji termini” screenshot.

**Implement:**

- Logged-out invitation to sign in, plus signed-in upcoming/history lists and reservation details.
- Only confirmed/cancelled business statuses. Group past appointments by time without inventing additional statuses. Include bookings made for another person under the booking owner's account.
- Explicit cancellation confirmation and the server's 30-minute rule. Show late-cancellation handling clearly; no false successful cancellation or automatic reschedule.
- Persistent in-app confirmations/change/cancellation messages, unread indication and owner-only mark-as-read operations. Keep privacy and transactional creation intact.
- Useful loading/error/empty states, refresh behavior and current linked-profile contact handling.

**Checks:** customer isolation by UI and direct API; same-user other-person bookings; upcoming/history grouping; exact cancellation boundary; retry/idempotency; cancelled capacity becomes available; notifications survive refresh and cannot be read/marked by another user; no external notification delivery.

**Review checkpoint:** book, inspect, cancel and refresh in development. Verify durable records agree with the UI. Explain that notifications are seen when the customer opens the application.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 10.`

## Phase 10 — Owner calendar and manual reservation management

**Outcome:** the owner can run everyday appointments across both locations from a secure calendar.

**Prerequisites:** owner authorization, stable schedule/booking APIs and customer notifications. Reuse the same availability rules and transaction protections.

**Implement:**

- Daily/weekly calendar, location filter, shared-barber occupancy and reservation detail views with authorized customer information.
- Manual reservation with name only, optional phone, and no email or fabricated account. Do not automatically attach a guest to a registered customer by name.
- Controlled appointment editing, retaining the old reservation until the new slot is accepted atomically. Preserve the booked service duration; follow the agreed cancel/new workflow for service changes.
- The same 15-minute/14-day bounds, published shifts, breaks, conflicts and travel rules apply to the owner. Add no silent bypass.
- Durable audit and notifications for linked customers. Explicitly show that an unlinked guest cannot receive in-app notifications.

**Checks:** ordinary customer denied owner routes/RPCs; owner allowed without a full customer profile; name-only guest; optional phone validation; overlapping manual booking rejected; failed move keeps the original; concurrent customer/manual booking conflict; filter views reflect shared occupancy; linked customer receives the change record.

**Review checkpoint:** demonstrate a normal owner working day using development data. Exceptional cancellations and mass-impact operations remain phase 11.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 11.`

## Phase 11 — Owner controls, affected bookings and audit

**Outcome:** exceptional changes are explicit, atomic and traceable, while customer history stays accessible.

**Prerequisites:** phase 10 owner interface and shared transaction/versioning support from phases 5 and 7.

**Implement:**

- Customer search/detail, booking ban and unban. Preview affected future reservations, require a reason and explicit confirmation, then cancel them atomically with the ban and notifications/audit.
- Include bookings for other people under that account. Preserve past/started appointments. A blocked customer may still log in and read history/notifications; unblocking does not restore cancelled bookings.
- Owner cancellation within 30 minutes of start with required reason and separate explicit confirmation. Keep this exception narrow.
- Safe schedule/shift/break/location/travel-gap changes: show the exact affected future reservations and require approval of that list. Recheck the revision/impact set immediately before committing; a new conflict requires a new preview.
- Service name/category/duration/order/activity controls. Durations are positive multiples of 10; preserve snapshots in confirmed bookings. No prices or arbitrary extra duration cap.
- Audit views and useful error/recovery states for all controlled mutations.

**Checks:** forged/stale confirmations; missing reason; unauthorized calls; booking arriving between impact preview and commit; rollback on failure; no unpreviewed cancellation; no deletion of started appointments; guest/no-notification handling; old duration snapshots unchanged; blocking and unblocking consequences. Complete A11–A15 with the earlier owner work.

**Review checkpoint:** the user reviews one schedule-impact change, one blocking flow and one exceptional cancellation in development, including their audit and customer-visible results.

**Next after acceptance:** `Read PHASE_PLAN.md and start phase 12.`

## Phase 12 — Final verification, handover and launch preparation

**Outcome:** an accepted release candidate, documented operations and a concrete launch decision. Public deployment is performed only if separately authorized.

**Prerequisites:** accepted phases 1–11; real contact details and domain/hosting decisions; confirmed production ownership. Recheck current provider limits and commercial-use terms when choosing/configuring hosting; old pricing notes are not a guarantee.

**Implement/verify:**

- Complete final email + password authentication with real email confirmation and password recovery after the domain and sender details are supplied. Configure verified SMTP, confirmation/recovery templates, final URLs/redirect allowlist and provider abuse controls. Verify delivery to an authorized recipient, failed/expired/reused confirmation, resend/recovery failures and session behavior. Re-enable confirmation for the final environment. Disable/remove temporary password-test flags before public release.
- Verify the real owner's email, then run the controlled production-owner bootstrap. Synthetic test ownership must never be copied into production. Recheck all earlier deferred email/identity criteria against the final flow; do not count password-test auto-confirmation as ownership proof.
- Run the full PRD A01–A20 acceptance matrix, including real development Auth/API, concurrency, both devices, mobile layouts and both daylight-saving transitions. Record pass/fail/evidence per criterion.
- Verify production build, supported dependency versions, relevant security advisories, accessible forms/navigation, image/font performance, error handling and useful empty states.
- Remove or clearly resolve prototype-only content. Add approved real contacts and the owner's privacy/contact information. Agree any outstanding retention/deletion requirements rather than inventing them.
- Prepare the chosen commercial-use-compatible hosting configuration, environment secrets, domain/HTTPS, Auth URLs and SMTP configuration. Keep the release candidate private or local until launch authorization.
- Document deployment and rollback steps, the ordered production migration/configuration plan, monitoring/quota ownership, database exports/backups and recovery. Test restoration in an isolated environment; do not claim Git restores live customer data.
- Provide a concise owner guide for publishing the current/next week, changing schedules safely, manual bookings, urgent cancellations and customer communication limits.
- Review outstanding issues with severity and effect. Critical booking-integrity, identity/access, delivery or data-loss problems block release.

**Launch checklist:** approved release commit/tag; tested recovery/export; correct production project/remote; required migrations and Auth/SMTP settings ready; verified owner; real contacts; actual current-week schedule published; production smoke-test plan with authorized data; explicit user authorization to deploy and apply production changes.

**Review checkpoint:** present the release candidate, completed acceptance matrix and remaining risks. If launch is not authorized, stop at “Ready for launch approval”. If authorized, verify actual deployment, production Auth and primary journeys, and record deployed revision/configuration. Never infer successful production verification from a local build.

**Next:** no further implementation phase is automatic. Tell the user either “Approve the prepared launch” with any missing prerequisites, or, after verified launch, give the owner operating instructions and remaining maintenance tasks.

## Required end-of-chat response

Every implementation chat must finish with:

1. **Phase and status:** ready for review, accepted, or blocked. State what actually works.
2. **Verification:** relevant checks and outcomes, clearly naming mocks, unrun checks and external blockers.
3. **Review:** preview URL/opening instructions and 3–5 concrete things the user should inspect when applicable.
4. **Checkpoint:** actual branch/commit/tag and push state, or explicitly “uncommitted / not pushed”. Mention schema/configuration changes and rollback limits.
5. **Next action:** if the phase needs review, say so first. If everything is verified and accepted, provide the next prompt: `Read PHASE_PLAN.md and start phase N.` Do not claim acceptance on the user's behalf.

When a phase is too large for one chat, finish a coherent partial checkpoint, record remaining scope, and recommend “Continue phase N”. Keep its status incomplete. The 12-chat count is a target, not a reason to omit tests or hide unfinished work.

## Handoff record — maintain in this document

Append one entry per implementation chat and update the progress table. Keep the latest entry sufficient for a new chat that has no earlier conversation history. Do not include credentials, real OTPs or unnecessary personal data.

```text
Date:
Chat phase / original website stage:
Status:
User approval evidence (actual response, or pending):
Repository / branch:
Starting accepted checkpoint:
Implemented changes and important file links:
Commands/tests and actual results:
Development vs. production verification:
Database migrations / Auth-SMTP-config changes (no secrets):
Preview and manual review steps:
Known issues / deliberately deferred work / blockers:
Commit / checkpoint tag / remote push state:
Rollback procedure and data/config compatibility:
Next action for the user:
Exact next-chat prompt:
```

### Planning handoff — 1 November 2026

- Scope: create this plan only. No website implementation resumed while writing it.
- Last accepted checkpoint: `checkpoint/00-foundation` / `5745e59`.
- Branch: `phase/01-auth`; existing application draft remains uncommitted and unapproved.
- Foundation review results are recorded above. No new application verification was performed for this documentation-only task.
- No implementation phase is marked accepted. The next chat must verify the actual working tree and inspect the draft before editing within the authorized phase 1 scope.
- Next action: open a new chat in this workspace. Select implementation mode when you want coding to begin.
- Next prompt: **Read PHASE_PLAN.md and start phase 1.**

### Phase 1 implementation handoff — 1 November 2026

- **Status:** Ready for review of the local account journey. User acceptance is pending. This is not a claim that real email login, profile writes or logout against a development Auth service passed.
- **Repository / branch:** `C:/Users/Cebo/Documents/Vule Still`, `phase/01-auth`; starting accepted checkpoint `5745e59` / `checkpoint/00-foundation`. Remote verified as `https://github.com/Sebastijan-S/vule-still.git`. Work remains uncommitted and unpushed.
- **Implemented:** Reworked the existing unapproved draft into an account shell, email-code login/registration, code-entry and resend states, protected profile, phone normalization, read-only verified email, current-device logout and local return destination allowlist. A verified-code/profile-read failure now proceeds to the protected profile page. Added request-time challenge parsing for Next.js Cache Components and a separate ignored build directory option. The homepage remains a minimal Phase 1 entry point; its full reconstruction belongs to Phase 4.
- **Key files:** `vule-still/src/app/prijava/`, `vule-still/src/app/profil/`, `vule-still/src/lib/auth/`, `vule-still/src/components/`, `vule-still/tests/auth-validation.test.mjs`, `vule-still/next.config.ts`.
- **Checks:** `npm.cmd run test:auth` passed 5 isolated validation/message tests. `npm.cmd run lint` passed. `$env:VULE_BUILD_DIR='.next-phase1-build'; npm.cmd run build` passed. `npm.cmd run check:supabase` passed read-only public API check (2 active locations, 7 active services, private tables denied). Production preview at `http://127.0.0.1:3100` rendered the logged-out appointments and login screens. A local cookie fixture showed code-entry, a disabled 60-second resend countdown, change-email action and expired-challenge return to email entry without sending a message. Browser checks found no horizontal overflow at 360, 390 or 1280 px. A malicious external `next` parameter resolved to `/moji-termini`.
- **Development vs. production:** No synthetic Auth user or booking was created in the future production Supabase project. No real OTP was requested. Wrong/reused provider codes, actual send limits, authenticated own-profile reads/writes, full logout and profile visual state remain unverified until an isolated development Auth service is available. The local fixture is UI evidence only. Do not count PRD A01/A02/A09/A16 as passed.
- **Schema / Auth-SMTP configuration:** No database migrations or provider settings changed. No domain, SMTP or sender configuration was applied. Code rollback is reverting this uncommitted branch to the accepted checkpoint after preserving any wanted draft work; there is no database rollback for this phase.
- **Review:** Open `http://127.0.0.1:3100/moji-termini` and `http://127.0.0.1:3100/prijava` while the local preview is running. Check the logged-out invitation, login layout at phone and desktop widths, labels and keyboard focus. Profile and logout visual review require a development login in Phase 2.
- **Next action:** Review the Phase 1 presentation and request any corrections. After acceptance, authorize its commit/tag if desired. Then proceed to Phase 2 only with a separately confirmed development Supabase project, SMTP sender/domain and authorized test recipient.
- **Exact next-chat prompt after acceptance:** `Read PHASE_PLAN.md and start phase 2.`

### Phases 2 and 3 prerequisite handoff — 2 November 2026

- **Status:** Both phases were started at the user's request and are blocked on external prerequisites. Phase 1 remains unaccepted and uncommitted. Neither phase 2 nor phase 3 is ready for review or accepted.
- **Repository / branch:** `C:/Users/Cebo/Documents/Vule Still`, still `phase/01-auth` with the uncommitted phase 1 draft. Remote remains `https://github.com/Sebastijan-S/vule-still.git`; starting accepted checkpoint remains `5745e59` / `checkpoint/00-foundation`. No branch switch, commit, tag or push occurred.
- **Inspection:** The connected Supabase tool resolves to reserved production project `usokysukvtgtvrtxnjai`; it has no development branches. A read-only count on 2 November showed one Auth user, zero owner memberships and the original three migrations. The prior handoff's zero-user count is therefore stale. No user identity or email was read, and no production mutation or OTP request was made.
- **Implemented:** Added `vule-still/supabase/AUTH_DEVELOPMENT.md` with an environment identity check, migration and Auth/SMTP checklist, real verification matrix and phase 3 session-behavior gate. This is documentation, not completed provider configuration or an inactivity implementation.
- **Verification:** Read-only project URL/branch/migration counts and local `git diff --check` completed. No real OTP, authenticated API, two-device or 30-day test was run. No production build is needed for this documentation-only change.
- **External blockers:** A separately confirmed development Supabase project, verified SMTP sender/domain access and an explicitly authorized recipient outside the project team are not available in this chat. The user has been asked for their status without requesting secrets. Phase 3 additionally requires phase 2's real Auth/API behavior. Do not create a paid Supabase branch or use production as a substitute.
- **Database / configuration / rollback:** No database migration, Auth setting or SMTP setting changed. Removing the documentation change is the only rollback needed for this chat; no data recovery is involved.
- **Next action:** Confirm the development project ID, sender/domain and authorized test recipient, then continue phase 2. After real phase 2 checks pass and its result is accepted, continue phase 3. Review and acceptance of phase 1 are also pending.
- **Exact next-chat prompt:** `Read PHASE_PLAN.md and continue phase 2 with the confirmed development Supabase project, SMTP sender and authorized test recipient.`

### Phases 3 and 4 implementation handoff — 2 November 2026

- **Status:** Phase 3 remains blocked on real development Auth/API and phase 2 delivery verification. Phase 4 public page is ready for visual review, not accepted. The user explicitly requested phases 3 and 4 together; no earlier phase acceptance is inferred.
- **Repository / branch:** `C:/Users/Cebo/Documents/Vule Still`, `phase/01-auth`, still based on accepted `5745e59` / `checkpoint/00-foundation`. The existing phase 1 draft and phase 2 setup record remain uncommitted. No branch switch, commit, tag or push was performed.
- **Implemented:** Rebuilt the public homepage from supplied screenshots using existing logo/hero assets, Supabase active services and locations, standard service rows, keyboard-operable premium accordion, two location cards, final call to action and responsive navigation. Added `/rezervacija` as an explicit unavailable-booking page, so entry points do not pretend to reserve a slot. No price, contact address or unpublished opening hours were invented. Updated build-directory ignore patterns.
- **Key files:** `vule-still/src/app/page.tsx`, `vule-still/src/app/globals.css`, `vule-still/src/components/site-shell.tsx`, `vule-still/src/app/rezervacija/page.tsx`, `vule-still/.gitignore`, `vule-still/eslint.config.mjs`.
- **Verification:** `npm.cmd run lint` passed after ignoring generated custom build directories. `npm.cmd run test:auth` passed 5 isolated tests. `npm.cmd run check:supabase` passed read-only against reserved production: 2 active locations, 7 active services, private tables denied, no writes. `$env:VULE_BUILD_DIR='.next-phase4-build'; npm.cmd run build` passed outside the restricted sandbox; the sandbox run compiled but its worker spawn failed with `EPERM`. Production preview showed 7 services, 2 locations and loaded brand assets. At 360, 390 and 1280 px, document scroll width did not exceed viewport width. Premium expanded with Enter and showed 3 individual 40-minute services. Booking link reached the explicit interim page. Browser recorded a font-preload warning, not a page error.
- **Development vs production:** The homepage currently reads only public catalogue rows from production because no development project has been confirmed. It performs no writes. Real Auth, two-device inactivity, RLS denial for stale direct tokens and owner bootstrap were not tested or implemented. No migration, Auth configuration or SMTP setting changed.
- **Review:** Local preview is `http://127.0.0.1:3100/` while the preview process is running. Compare hero, services/premium expansion, two locations, footer and phone layout against the reference screenshots. Check `/rezervacija` states clearly that booking is unavailable. Phase 8 will replace that page with the actual booking journey and connect service/location selections.
- **Known blockers:** A separately confirmed development Supabase project and real phase 2 Auth flow are needed before phase 3's session model can be chosen and verified. SMTP sender and authorized test recipient are still unconfirmed. Phase 1 presentation has not been explicitly accepted. Phase 4 remains subject to the user's visual review.
- **Checkpoint / rollback:** All changes remain uncommitted and unpushed. No data/config rollback is required. Code can be restored from the accepted checkpoint only after preserving the wanted uncommitted phase 1–4 work.
- **Next action:** Review the phase 4 page visually. Confirm a separate development Supabase project, verified SMTP sender and an OTP test recipient so phase 2 can finish; then implement/verify phase 3 before booking work. If phase 4 needs visual changes, request them directly.
- **Exact next-chat prompt:** `Read PHASE_PLAN.md and continue phase 2 and phase 3 with the confirmed development Auth environment; preserve the phase 4 page pending visual review.`

### Auth testing clarification — 2 November 2026

- **Latest user decision:** The user wants to continue with the single existing Supabase project and authorized a real login test using the recorded owner email `sekosansebastijan@gmail.com`. This supersedes the earlier assumption that a second project would be supplied. Do not create synthetic users or bookings, change account activity timestamps, or run failure fixtures in this future-production project. Full phase 3 boundary tests still require an isolated environment; report that limitation explicitly.
- **Active local preview:** `http://localhost:3000/` responded HTTP 200 and contained the current homepage. The earlier phase 4 preview on port 3100 was no longer running. The local app's ignored `.env.local` points to `usokysukvtgtvrtxnjai.supabase.co`. For current manual login, use `http://localhost:3000/prijava`.
- **Read-only Auth evidence:** The public Auth settings endpoint reports email enabled and confirmation required. The confirmed owner address has no Auth account yet. Auth logs show `/otp` requests rejected with HTTP 429 and `over_email_send_rate_limit`; a prior OTP request succeeded, but the owner address was not verified. Supabase's built-in SMTP is documented as limited to 2 emails per hour across the whole project and restricted to project-team recipients. No new OTP was sent in this chat.
- **Template access:** After the user shared a signed-in Supabase dashboard tab, the `Authentication → Emails → Magic link or OTP` template was inspected. It currently contains the default `Your sign-in link` email with `{{ .ConfirmationURL }}` rather than a numeric code. The dashboard states that custom SMTP must be enabled to edit the template, and the SMTP toggle is currently off. No settings were changed. The app expects a numeric `{{ .Token }}` code, so the current email template cannot complete that form's intended flow.
- **Code change and checks:** The login form now explains the project-wide email send limit when Supabase returns its specific error code; `test:auth` includes a regression assertion. `npm.cmd run test:auth` passed 5 tests, `npm.cmd run lint` passed, and `$env:VULE_BUILD_DIR='.next-phase4-build'; npm.cmd run build` passed outside the restricted sandbox. Updated `vule-still/supabase/AUTH_DEVELOPMENT.md` to reflect the user's single-project decision and limit future-production tests to the real authorized owner account. No database, Auth or SMTP configuration changed. Changes remain uncommitted and unpushed on `phase/01-auth`.
- **Next action:** Inspect/configure the Magic Link email template in the signed-in Supabase dashboard, then wait for the project email quota or configure a verified custom SMTP sender. Only then send one code to the confirmed owner address and verify receipt, session and profile. Do not disable email confirmation to avoid the limit.

### Temporary Supabase test environment — 2 November 2026

- **User decision:** The user authorized a temporary Supabase project to test before buying a domain. The existing `usokysukvtgtvrtxnjai` project remains the future production project. No purchase, Git publication or production configuration change was authorized or performed.
- **Test project:** Created `Vule-still-test` (`xfbjgxtgvlyndonhlupm`) on the Free plan. The database password was regenerated after creation. Data API and automatic RLS are enabled; automatic table exposure is disabled. No GitHub integration was connected.
- **Schema/data:** Ran the three existing foundation SQL files in order through the test project's SQL Editor. The SQL Editor does not record these as CLI migration versions, so inspect the test schema before any replay. Read-only SQL confirmed 2 locations, 7 services and 0 Auth users. `node --env-file=.env.test.local scripts/check-supabase.mjs` passed: test project identity, public catalog, denial of anonymous private tables, internal schema not exposed, 0 writes.
- **Local configuration:** Ignored `vule-still/.env.test.local` holds only the test URL, publishable key and `.next-test` build directory. Ignored `.env.local` continues to target the future production project. No secret or database password was added to source or Git. The separate test preview started at `http://localhost:3100/` and returned HTTP 200 with the expected service content; `http://localhost:3000/` remains the main-project preview.
- **Auth explanation:** The website already calls `signInWithOtp` and `verifyOtp`; a row for an email in Supabase Auth does not create a browser session. The visitor must receive and verify the one-time credential. The default hosted email template sends a link, while the current form expects digits. A second project alone does not resolve this or the built-in sender's limit. Real delivery and signed-in profile checks remain pending; phase 2 is not complete, and phase 3 has not started implementation.
- **Next:** Configure a verified SMTP sender and numeric OTP template when available, then perform the authorized real email test. Meanwhile use the isolated test project for non-email Auth/API integration work and future 30-day boundary tests. Keep future-production data untouched.

### Phase 2 continuation, no-email verification — 2 November 2026

- **Status:** Phase 2 remains blocked, and phase 3 did not advance. The temporary test project is available, but no verified Auth session exists there. Phase 1 and phase 4 still await review. No acceptance, commit, tag or push is inferred.
- **Repository / preservation:** `C:/Users/Cebo/Documents/Vule Still`, branch `phase/01-auth`, remote `https://github.com/Sebastijan-S/vule-still.git`. Existing uncommitted application work was preserved; this continuation added `vule-still/scripts/check-auth-no-email.mjs` and updated only the Auth development record and this plan. The future-production project was not contacted by these new checks.
- **Live test project checks:** `node --env-file=.env.test.local scripts/check-supabase.mjs` passed for `xfbjgxtgvlyndonhlupm`: 2 locations, 7 services, anonymous private-table denial, internal schema not exposed, 0 writes. `node --env-file=.env.test.local scripts/check-auth-no-email.mjs` passed: email provider enabled, confirmation required, anonymous `/auth/v1/user` returned 401, invalid bearer profile read returned 401. The script made no OTP request and created no account.
- **Local checks:** `npm.cmd run test:auth` passed 5 isolated validation/UI-state tests; `npm.cmd run lint` passed. The ten-minute challenge test covers local cookie parsing, not provider OTP expiry. No application source or migration was changed in this continuation, so no new production build or SQL migration test was run.
- **Not tested:** Numeric email delivery, new/returning account verification, provider wrong/expired/reused code handling, resend and OTP lifetime settings, authenticated profile creation/read/update and cross-user denial, logout, two-device sessions, 30-day boundaries, stale direct API access, and owner bootstrap. Anonymous or invalid-token denials do not prove authenticated RLS. No privileged-key client-bundle inspection was performed.
- **External configuration:** Verified SMTP sender/domain, editable `{{ .Token }}` template, and an explicitly authorized recipient for the temporary test project are missing. OTP expiry, provider resend interval, Site URL and redirect allowlist have not been verified in that project's dashboard. No Auth/SMTP configuration or database object was changed. The previously authorized owner email test concerned the future-production project and is not treated as a temporary-project recipient authorization.
- **Phase 3 gate:** Its prerequisite is a real verified development Auth session and authenticated API evidence from phase 2. Because that evidence is absent, no inactivity migration, token-behavior assumption, timestamp manipulation or admin provisioning was attempted.
- **Rollback:** Remove the new no-email check script and documentation entries to revert this continuation. No data or external setting needs rollback.
- **Next action:** Supply or configure a verified SMTP sender and numeric OTP template, and explicitly authorize a recipient on the temporary test project. Then run the phase 2 real delivery/authenticated matrix. Begin phase 3 only after that gate is met; preserve all existing local work during any later checkpoint.
- **Exact next-chat prompt:** `Read PHASE_PLAN.md and continue phase 2 on Vule-still-test with the configured SMTP sender, numeric OTP template and authorized recipient; proceed to phase 3 only after real Auth/API checks pass.`

### Temporary password Auth and phase 3 continuation — 2 November 2026

- **Latest user decision:** Postpone email sending. Use email plus password without email confirmation only on temporary Vule-still-test, then implement email confirmation plus password before public release. This supersedes the earlier assumption that phase 3 must wait for delivered OTP, but does not turn an implicitly confirmed test address into proof of ownership. The user confirmed the test project's `Confirm email` toggle at action time. Future-production `usokysukvtgtvrtxnjai` was not changed.
- **Status/checkpoints:** Phase 2 real delivery remains blocked/deferred. Phase 3 is in progress: account inactivity and session access are implemented and tested; genuine owner email verification and bootstrap remain pending. Phases 1 and 4 still await review. Branch remains `phase/01-auth`, remote `https://github.com/Sebastijan-S/vule-still.git`; all existing local work was preserved. No commit, tag or push occurred.
- **External configuration:** In the signed-in Supabase dashboard for `Vule-still-test` (`xfbjgxtgvlyndonhlupm`), `Confirm email` was turned off after the user's explicit confirmation. The public Auth settings endpoint then reported `mailer_autoconfirm=true`. Email provider remains enabled; no SMTP/template/production setting was changed. Ignored `.env.test.local` now includes `VULE_AUTH_MODE=password-test` and `VULE_PHASE3_ACCESS=1`; both flags fail if the project hostname is not the temporary test project. Ignored `.env.local` still targets future production.
- **Code and migration:** Added test-only password signup/sign-in, server session registration and activity RPCs, a same-origin activity POST from visible/interacted UI, and profile text that does not call an unverified test email verified. Added [account activity migration](./vule-still/supabase/migrations/20261102180000_account_activity.sql) with account-wide 30-day timestamp, Auth `session_id` registration, generation/revocation boundary, private-table RLS and no direct client writes. It was applied once to the temporary project through SQL Editor after confirming `auth.sessions(id,user_id,created_at)` and the absence of both new tables. SQL Editor did not record a CLI migration version; inspect before any replay. It was not applied to future production.
- **Real Auth/API checks:** `node --env-file=.env.test.local scripts/check-password-auth.mjs` passed twice (before/after migration), creating four synthetic test users in total. Two devices received distinct signed `session_id` claims; refresh preserved the ID; profile trigger/own update worked; other profile, forged admin metadata and direct role write were denied; local logout left the other device active. `node --env-file=.env.test.local scripts/check-account-boundary.mjs` passed with one more synthetic user and controlled SQL Editor timestamp edits limited to that account: at 29 days phone activity kept desktop active; at exactly 30 days old direct Data API access and old activity were denied; fresh login worked without reviving desktop; local logout caused direct denial of the revoked session's still-unexpired JWT. `node --env-file=.env.test.local scripts/check-refresh-no-touch.mjs` passed with one additional synthetic user: the exact database `last_activity_at` value was identical before and after real `auth.refreshSession()` plus repeated access check. No email was sent, and no credentials/tokens were printed. These six script-created users plus one browser-created synthetic user remain in the temporary project.
- **Application check:** At `http://localhost:3100/`, a sixth synthetic user completed signup, profile edit, local logout, protected-profile redirect, and returning password sign-in. An authenticated `POST /api/account-activity` returned 204; anonymous and wrong-Origin POSTs returned 401 and 403. After adding `connection()` to request-time session validation, the final test-environment production build passed and the profile preview rendered without the earlier Next.js unstable-time errors. The preview is running on port 3100 while its project-owned process remains active.
- **Isolated and static checks:** `npm.cmd --prefix supabase/tests test` passed 45 foundation checks and 17 phase 3 PGlite checks; the latter passed before the cloud migration and again after test refinements. It covers one minute before/at/one minute after expiry, cross-device access, repeated access checks not updating activity, no old-session revival, revoked sessions, and simulated verified/unverified owner permissions. Auth users/sessions are fixtures in this SQL test. `npm.cmd run test:auth` passed 5 local tests; `npm.cmd run lint` passed; the production build with the test environment loaded and separate `.next-phase3-build` passed; `node --env-file=.env.test.local scripts/check-supabase.mjs` and `scripts/check-auth-no-email.mjs` passed. `git diff --check` passed. The first sandbox build hit `spawn EPERM`; the final elevated build passed. An earlier `node --env-file` build failed because Next.js worker processes reject `--env-file` in `NODE_OPTIONS`; loading the ignored environment into process variables resolved that runner issue.
- **Known limits:** The live before/after comparison proved a manually requested Auth token refresh plus repeated access check did not advance activity. Automatic refresh timing and prefetch were not measured separately. A genuinely verified owner does not exist in the temporary no-confirmation mode; the privileged owner bootstrap was deliberately not run. Numeric OTP/new-user email delivery, provider expiry/resend/failure checks and final email-plus-password confirmation are untested. Do not publish or copy synthetic Auth users to production. The final mode must re-enable confirmation and replace the old default OTP journey with email-plus-password confirmation, including password recovery decisions.
- **Review:** Open `http://localhost:3100/prijava` and inspect the temporary password form; while signed into a synthetic test account, check `/profil` and its explicit unverified-test-email label, then local logout and protected access. Review the phase 3 migration and 30-day test evidence before any production schema work.
- **Rollback/compatibility:** Test Auth configuration can be restored by turning `Confirm email` back on. The additive phase 3 migration has no automatic down migration; do not drop its tables while a client is using `VULE_PHASE3_ACCESS=1`. Remove that flag before a code rollback in test. Future production remains at the three foundation migrations and the default OTP code path.
- **Next action:** Obtain actual owner email verification before privileged bootstrap. Separately configure SMTP and email-plus-password confirmation before public release. Do not mark phases 2 or 3 Accepted until their remaining checks and user review pass.
- **Exact next-chat prompt:** `Read PHASE_PLAN.md and review phase 3 inactivity results on Vule-still-test; preserve test-only password mode and defer owner bootstrap until genuine email verification. Then prepare email-plus-password confirmation for final release.`

### Phases 4 and 5 continuation — 2 November 2026

- **Status:** Phase 4 remains ready for visual review, not accepted. Its existing public page was reopened on the test preview and showed the seven services, two locations and interim booking links. No new visual acceptance is inferred. Phase 5 is in progress; its isolated schedule checks pass, but no live test-project migration or owner publish was performed. Phases 2 and 3 retain their previous limits.
- **Repository:** `C:/Users/Cebo/Documents/Vule Still`, branch `phase/01-auth`, remote `https://github.com/Sebastijan-S/vule-still.git`. Earlier uncommitted work was preserved. No commit, tag, push or production project change occurred.
- **Implementation:** Added `vule-still/supabase/migrations/20261102210000_schedule_foundation.sql`, `vule-still/supabase/tests/schedule.test.mjs`, `vule-still/src/app/raspored/` and `vule-still/supabase/SCHEDULE.md`. The schedule model has a Monday–Saturday starting template, private draft, separate published snapshot, revision checks, owner-only mutation RPCs, public published-only RPC, shift/break/travel validation and a basic weekly editor. Days without shifts represent days off; a separate absence entity and booking-impact preview are not implemented. Phase 4 CSS gained styles for the owner editor, with no change to the public page's structure/content.
- **Actual isolated checks:** `npm.cmd --prefix supabase/tests test` passed 45 foundation, 17 activity and 12 schedule checks in PGlite. Schedule tests include unpublished privacy, template, owner/anonymous permissions, revision conflict, overlap, travel gap, invalid break, duplicate/date boundary, publication and draft isolation. Auth identities and sessions in these SQL tests are fixtures, not real Supabase Auth. `npm.cmd run test:auth` passed 5 tests. `npx.cmd tsc --noEmit`, `npm.cmd run lint` and `git diff --check` passed after fixing a synchronous effect state reset. A test-environment production build with `.next-phase5-build` passed outside the sandbox after the sandbox worker returned `spawn EPERM`.
- **Actual live no-email checks:** `node --env-file=.env.test.local scripts/check-supabase.mjs` passed on `xfbjgxtgvlyndonhlupm`: 2 active locations, 7 active services, anonymous private-table denial, internal schema hidden, no writes. `scripts/check-auth-no-email.mjs` passed: email provider enabled, confirmation disabled in this temporary project, anonymous Auth user and invalid bearer profile denied, no mail/account created. `scripts/check-schedule-live.mjs` returned **HTTP 404** for `published_schedule`: the new migration is absent in the test project. This is a failed availability gate, not a passed live phase 5 test. The integrated dashboard opened a sign-in page and computer-use inventory could not access the user's existing browser, so the test database was not mutated.
- **Not tested:** Live schedule RPCs, real owner login/bootstrap, owner editor actions, public result after test-week publication, cross-account owner denial, simultaneous cloud edits, mobile editor, separate absence records, timezone transition with a published schedule, booking-impact reconciliation and final email delivery. No email was sent. Password-only test accounts do not prove email ownership, so none was granted owner status.
- **Rollback:** Code can be reverted while preserving prior work; no phase 5 database rollback is needed because the migration was not applied. The new migration is additive and has no automatic down migration. After application, disable its callers before any separate data/schema recovery.
- **Next action:** Apply the reviewed migration once to `Vule-still-test` through a signed-in project-specific SQL editor, then verify its public RPC. Complete genuine owner email verification and controlled bootstrap before testing owner edits/publication. Visually review the phase 4 page at 360, 390 and 1280 px and approve or request corrections. Do not begin phase 6 until live phase 5 publication and access checks pass.
- **Exact next-chat prompt:** `Read PHASE_PLAN.md and continue phase 5 on Vule-still-test: apply the reviewed schedule migration, verify the public RPC, then test the owner editor only after genuine owner email verification; preserve phase 4 pending visual review.`

### Completion of phases 5–6 and source backup — 3 November 2026

- **Latest user scope and acceptance:** Earlier account, inactivity and public design work is accepted per the user's explicit statement that it was checked and satisfactory. Phases 1–6 are now marked Completed for the agreed development scope. All real email confirmation/delivery, SMTP/domain details and genuinely verified production-owner provisioning belong to phase 12. This handoff supersedes the old blocked-email and missing-schedule instructions above. The new calendars retain a manual user review checklist; implementation completion is not a claim that the user has already reviewed their new appearance.
- **Environment:** Only `Vule-still-test` (`xfbjgxtgvlyndonhlupm`) receives synthetic Auth/schedule tests. The supplied project URL/publishable key identify that test environment; a publishable key does not grant DDL or owner-assignment access. Schedule and availability RPCs and a synthetic owner were already present when resumed and have now been exercised through real Auth/Data API. Their presence is not a verified CLI migration history: inspect the schema before replaying SQL Editor migrations. No production migration, domain change or real email was performed.
- **Calendar implementation:** `/raspored` has two weekly time-grid calendars, Zrenjanin and Neuzin, with a shared week selector, per-location day add buttons, shift dialog, multiple breaks, removing shifts/days off, draft/published view, explicit save and publish, Serbian dates and 24-hour times. Small screens scroll each grid locally without overflowing the page. Revision checks remain database-enforced. Requests have bounded waits and uncertainty messages; Escape returns keyboard focus to the edited shift.
- **Availability implementation:** [pure engine](./vule-still/src/lib/availability.ts), [public API](./vule-still/src/app/api/availability/route.ts), [SQL context/interval foundation](./vule-still/supabase/migrations/20261102220000_availability_context.sql) and [contract](./vule-still/supabase/AVAILABILITY.md). It handles published shifts, multiple breaks, shared occupancy, travel, active service duration, inclusive local 14-day horizon and exact 15-minute cutoff without reseeding the slot grid. It distinguishes unpublished/closed/booked/too-short/cutoff states, uses the database clock and returns no customer identity/contact. Both DST transitions are covered; ambiguous times have distinct instants/offsets. Public availability remains advisory; customer reservation writes are closed until phase 7.
- **Passed checks:** 80 isolated SQL checks, 14 availability groups, 5 local Auth validation tests and **5 final browser tests**; final `npm.cmd run lint` and `npm.cmd run build:test` passed. Browser tests ran against the final completed production build with test environment: all three widths, owner login return, focus, same-origin activity (204), cross-origin denial (403), save/publish and restoration passed. `node --env-file=.env.test.local scripts/check-schedule-live.mjs` returned HTTP 200. The owner integration script passed 6 checks; the anonymous availability/Next API script passed 5. Exact scopes and dated results are recorded in [SQL results](./vule-still/supabase/tests/RESULTS.md).
- **Concurrency evidence and limit:** Two real simultaneous saves with the same revision produced exactly one successful write; readback proved a single revision increment and no lost update. The losing request reached a client timeout rather than an observed `40001` HTTP result. The UI now stops waiting after 12 s and requires reload to inspect authoritative state. Preserve this evidence; do not call the timeout a successful conflict response. Review HTTP conflict signaling when extending locking/RPCs in phase 7.
- **Browser verification:** Playwright checks actual rendered calendars at 360, 390 and 1280 px, shift dialog bounds, Escape/focus restoration and save/publish with restoration of the original shift. A same-origin activity regression was found on `127.0.0.1`: Next's internal request hostname differed from HTTP Host. The guard now uses incoming Host plus request protocol, never X-Forwarded-Host; authenticated same-origin and cross-origin denial are part of the browser gate. Screenshots are local ignored test output, not source or credentials.
- **Owner login navigation:** The safe return allowlist includes `/raspored`; password login can return there without requiring a customer booking profile. The server route and database RPCs still enforce owner membership. Ordinary customer/anonymous denial passed separately; a return URL is never an authorization grant.
- **Test data:** The original saved draft was preserved and the test week starting 2 November was published. Live scripts use existing clearly synthetic accounts in ignored `.env.phase6-state.local`; no test password, session or privileged key is committed. Browser tests temporarily change one shift, save/publish it and restore the original. Occupied-interval and DST failure fixtures remain isolated SQL/pure tests; no real customer booking was created.
- **Preview and repeatable commands:** From the application folder use `npm.cmd run dev:test`, or `npm.cmd run build:test` followed by `npm.cmd run start:test`, then `http://127.0.0.1:3100/raspored`. The guarded runner loads `.env.test.local` and refuses another project. Do not run two servers on port 3100. Browser tests target a stable completed build; building while a dev server watches generated build/type files caused repeated reloads, so avoid that combination for UI verification.
- **Git backup/recovery:** The user explicitly authorized committing and pushing all intended work to `Sebastijan-S/vule-still` for recovery. Keep the current branch `phase/01-auth` rather than moving away from the accumulated changes. `main` remains the original accepted foundation; no website deployment is implied. The actual created checkpoint is recorded below. Git restores code only; cloud data, Auth settings and migrations require separate recovery/export. Prefer additive compatibility and never reset/drop the live database as part of a code rollback.
- **User checklist before phase 7:** Open both calendars on phone/desktop; edit a shift, add a break and cancel the dialog; save a harmless test change and confirm that the published view remains unchanged until explicit publication. Restore the desired test schedule. Check both locations and the current/next week selector. No domain purchase, SMTP setup or email verification is needed now. New accounts are ordinary customers; owner membership is assigned separately and is never self-service.
- **Next phase:** Phase 7, atomic reservation/cancellation operations, idempotency, ownership/guest schema and real concurrent booking checks. Before enabling writes, integrate the same week locking and exact affected-booking confirmation into schedule publication. Do not assume the phase 6 availability response reserves a slot. Later customer/owner screens remain phases 8–11.
- **Exact next-chat prompt:** `Read PHASE_PLAN.md and its latest handoff. Start phase 7 on Vule-still-test: implement atomic reservations, access protection, idempotency and concurrent booking checks; integrate safe schedule publication before enabling booking writes. Keep password authentication without email confirmation for now; domain, SMTP, real owner verification and final email + password confirmation belong to phase 12. Work only on phase 7 and finish with tests and a handoff.`

### Created recovery checkpoint — 3 November 2026

- Code and test handoff commit: `3faf5fe84486ec26f261d37786d634e050cf42ba` — `feat: preserve location calendars and availability checkpoint`.
- Annotated tag: `checkpoint/06-availability`, created and verified locally at that commit. This shared checkpoint includes all implemented phases 1–6; no separate per-phase history is invented.
- Branch: `phase/01-auth`. The following documentation commit records this already-created tag without rewriting the code checkpoint. Publication of the branch and tag is explicitly authorized; verify remote refs when restoring or beginning a fresh clone.
- GitHub destination: [Vule Still](https://github.com/Sebastijan-S/vule-still). The tag restores application sources, assets, migrations and tests. Keep ignored test environment/fixture credentials locally; Git does not restore Supabase data or external settings. Production `main` and production database have not been promoted by this checkpoint.
