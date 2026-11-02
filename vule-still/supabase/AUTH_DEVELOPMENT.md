# Auth setup and verification

## Current override — 3 November 2026

The user explicitly moved all real email confirmation/delivery and genuine production-owner provisioning to phase 12, after domain purchase and final contact/sender details. Phases 3–11 use temporary email + password with confirmation disabled only on Vule-still-test. A controlled synthetic test owner now exercises schedule administration there; it is not genuine email ownership. The older statements below saying a synthetic owner must never be provisioned are historical and superseded only for this named disposable test project. Keep the real production bootstrap unchanged, and never copy test Auth users or memberships to production.

The schedule/availability RPCs and synthetic owner are present in the test project. Live owner/customer/anonymous checks passed; see [schedule record](SCHEDULE.md), [availability record](AVAILABILITY.md) and the latest [phase handoff](../../PHASE_PLAN.md). No real email delivery is claimed. Keep ignored local test configuration/credentials out of Git. A publishable key does not grant privileged migration or role-assignment access.

This is the phase 2 setup record. The future-production project is `usokysukvtgtvrtxnjai`. On 2 November 2026 the user authorized a separate temporary test project; `Vule-still-test` (`xfbjgxtgvlyndonhlupm`) was created on the Free plan. Only the test project may receive synthetic accounts, bookings, timestamp manipulation, or failure fixtures. No SMTP sender has been confirmed.

The three foundation SQL files were run in order in the test project's SQL Editor. On 2 November the phase 3 `20261102180000_account_activity.sql` migration was also applied there after a read-only schema preflight and isolated SQL tests. SQL Editor execution is not recorded as Supabase CLI migration history; inspect the schema before replaying any file. At setup the test project had 2 locations, 1 staff resource, 7 services, and 0 Auth users. Later synthetic Auth accounts remain in this temporary project. Its ignored `.env.test.local` contains the project URL, publishable key, separate build directory, and test-only Auth/access flags. The ignored `.env.local` still points to future production. `node --env-file=.env.test.local scripts/check-supabase.mjs` passed: public catalog readable, anonymous private-table access denied, internal schema not exposed, no writes.

To start a separate local test preview, run this from `vule-still/` in PowerShell (the server then uses port 3100 and `.next-test`):

```powershell
Get-Content .env.test.local | ForEach-Object {
  $pair = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($pair[0], $pair[1], 'Process')
}
node node_modules/next/dist/bin/next dev -p 3100
```

Next.js may still list `.env.local` among loaded files; the process variables above take precedence. The main local server on port 3000 continues to use the future-production configuration. A test preview HTTP 200 and the expected service content were verified on port 3100. This is not a successful email login check.

## Environment identity

1. Confirm `.env.local` points to `usokysukvtgtvrtxnjai.supabase.co` before a real owner login. For isolated tests, use `.env.test.local` and verify the expected `xfbjgxtgvlyndonhlupm.supabase.co` result. Never print or commit privileged keys. The browser receives only the publishable key.
2. The three foundation migrations are already applied. Never replay them over this existing schema. `npm.cmd run check:supabase` is read-only and has confirmed two locations, seven services and denied anonymous private-table access.
3. The user authorized temporary password-only registration on the test project to continue phase 3. `Confirm email` is disabled **only** there; Supabase then marks test emails as confirmed without delivery. These accounts are not evidence of email ownership. Never provision the owner from one of them.
4. Use only the temporary test project for timestamp manipulation, synthetic accounts, direct denial scenarios or 30-day boundary tests. Do not weaken RLS or rate limits. Before any public release, re-enable email confirmation, implement the agreed email-plus-password flow, configure SMTP, and verify real delivery.

## Auth configuration outside migrations

Record the actual dashboard settings and verification date here after configuring them. SQL migrations do not reproduce Auth, SMTP or URL settings.

| Setting | Target / check | Verified value/date |
| --- | --- | --- |
| Email provider | Enabled; email confirmation required for public release | Enabled; `Confirm email` temporarily disabled on Vule-still-test for password testing, verified by public Auth settings on 2 Nov 2026 |
| Magic Link or OTP email template | Numeric OTP via `{{ .Token }}` for both signup and returning sign-in; no login link | Current default is a sign-in link; editing disabled until custom SMTP, confirmed 2 Nov 2026 |
| OTP expiry | 600 seconds (10 minutes), if supported by this project's provider settings | Pending |
| Minimum resend interval | At least 60 seconds, enforced by Auth provider; test actual behavior | Pending |
| SMTP sender | Verified sender domain and address; credentials stored only in Supabase settings | Custom SMTP disabled, confirmed 2 Nov 2026 |
| Site URL | Intended local and later public origin | Pending |
| Redirect allowlist | Only intended origins/paths | Pending |
| Abuse protection | Record provider limits and public-release CAPTCHA/rate-limit decision | Pending |

The old OTP form remains the default outside the temporary test mode. The user has since chosen email plus password and real email confirmation as the final public flow; its confirmation template and SMTP are still pending. The test-only password mode never runs against the future-production project.

## Checks possible before SMTP setup (2 November 2026)

Run `node --env-file=.env.test.local scripts/check-supabase.mjs` and `node --env-file=.env.test.local scripts/check-auth-no-email.mjs`. Both scripts assert the temporary project hostname before contacting it. The second script makes only GET requests to Auth settings/current-user and an invalid-token private-profile read; it sends no OTP, creates no user, and performs no database write.

Observed initial live results: the public catalog contained 2 locations and 7 services; anonymous reads of `profiles`, `admin_memberships`, and `staff` were denied, and `app_private` was not exposed. Email Auth was enabled with confirmation required at that time; anonymous `/auth/v1/user` returned 401, and a deliberately invalid bearer token could not read `profiles` (401). After the authorized temporary toggle, the same script reports email confirmation disabled in Vule-still-test. These checks alone do not establish a valid session or code delivery; the password integration checks below are separate evidence.

The existing `npm.cmd run test:auth` passed 5 isolated validation/UI-state tests and `npm.cmd run lint` passed. The isolated challenge expiry test is application logic only; it does not measure the Supabase OTP lifetime. No production build was needed because this continuation changed only a standalone check script and documentation.

## Real verification matrix

The owner address is explicitly authorized for one real login test. The built-in SMTP may deliver only to Supabase organization team members; confirm that constraint before sending. Record outcomes without codes, tokens or unnecessary personal data.

| Check | Result |
| --- | --- |
| New account receives and verifies numeric code | Pending |
| Returning account receives and verifies numeric code | Pending |
| Wrong, expired and reused code denied | Pending |
| Resend inside and after 60 seconds; server limit verified | Pending |
| SMTP failure and recovery shown to the user | Pending |
| New verified user gets exactly one private profile | Pending |
| Own profile read/update succeeds; another profile denied by direct API | Pending |
| Current-device logout persists after reload | Pending |
| No privileged key or SMTP secret in client bundle | Pending |

## Temporary password and phase 3 evidence — 2 November 2026

- `node --env-file=.env.test.local scripts/check-password-auth.mjs` passed twice, before and after the phase 3 migration. Each run created two clearly synthetic Auth users with in-memory random passwords; four test users remain. It confirmed separate signed `session_id` claims on two devices, stable `session_id` after refresh, automatic private profile creation, own-profile update, denial of another user's profile, failed role write and forged metadata, and local logout leaving the other device active. It sent no email and printed no credentials/tokens.
- `npm.cmd --prefix supabase/tests test` covers 45 foundation checks plus 17 isolated activity/session/RLS checks. The phase 3 checks include before/at/after 30 days, cross-device activity, no touch on repeated access checks, old-session denial after new login, session revocation, and simulated verified/unverified owner policies. Auth claims and sessions are fixtures in this SQL test; the following live test is separate.
- `node --env-file=.env.test.local scripts/check-account-boundary.mjs` passed against the real test project's Auth/Data API with one additional synthetic user. The script paused while only that user's `last_activity_at` was set in SQL Editor to 29 days ago and then exactly 30 days ago. Phone activity kept desktop access active; at 30 days an old direct API token and old activity call failed; fresh password login worked; old desktop remained denied; local logout caused direct RLS denial of the revoked session's still-unexpired JWT. This manually applied timestamp fixture is not part of the migration.
- `node --env-file=.env.test.local scripts/check-refresh-no-touch.mjs` passed with one more synthetic user. A read-only SQL Editor query returned the exact same `last_activity_at` value before and after real `auth.refreshSession()` plus repeated `ensure_session_access()`; neither operation counted as activity. The script compared the two observed values without printing credentials or tokens.
- The application preview at `http://localhost:3100/` completed test-only password signup, profile creation/update, local logout and protected-profile redirect. An authenticated `POST /api/account-activity` returned 204; anonymous and cross-origin POSTs returned 401 and 403. The final build passed with the test environment loaded. The profile explicitly labels the test address as **not verified**.
- Auth token refresh kept the same `session_id`, and the live before/after database timestamp comparison confirmed that refresh plus repeated access check did not advance activity. The preview's visibility/user-input ping is the explicit activity source, not proxy refresh.
- No real email was delivered or verified. Owner bootstrap was not run. `email_confirmed_at` in this temporary mode is implicit provider state, not proof that the address belongs to the user. The owner and public-release Auth checks remain deferred.

Real delivery remains blocked by a verified SMTP sender/domain, editable numeric OTP template, and an authorized recipient for the temporary test project. The previously authorized owner address was for a single login in the future-production project; it has not been treated as authorization to send from this test project. Dashboard-only OTP expiry, resend interval, Site URL, allowlist, and SMTP values remain unverified. Do not mark phase 2 complete from the no-email checks.

Use controllable timestamps only in an isolated environment for phase 3 activity tests. Do not wait 30 real days or alter production data. The existing owner bootstrap script must run only after the chosen owner account has genuinely verified its email; do not run it as part of an email-delivery test.

## Phase 3 implementation gate

The test project now has a real `session_id` and Data API basis for phase 3. The versioned migration was applied there after 17 isolated SQL checks, and direct API denial at the 30-day boundary plus live no-touch-on-refresh checks passed. The future-production project has **not** received this migration. The remaining phase 3 gate is real owner email verification before bootstrap. Final email-plus-password delivery is also required before public release. The temporary password-only project must never be treated as proof of email ownership.

References: [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), and the project [phase plan](../../PHASE_PLAN.md).
