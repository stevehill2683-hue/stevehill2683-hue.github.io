# Steve & Anita Website
## Confidential Member Management Plan

**Branch:** `visitor-log-test`  
**Status:** Planning checkpoint  
**Live `main` website:** No changes permitted during development

---

## 1. Purpose

Build a secure owner-only management area inside the Confidential dashboard.

The owner will be able to:

- View family members.
- Add a family member.
- Edit a member’s display name.
- Assign or replace a secure six-digit family access code.
- Activate or deactivate family access.
- Turn Steve Test Logging on or off.
- Create temporary visitor codes.
- Set an expiration date and time for temporary codes.
- Deactivate temporary codes before expiration.
- View visit records and page history.
- See clear security and connection messages.

---

## 2. Security Rules

Every member-management request must require a valid owner session.

The Worker must reject a request when:

- The owner token is missing.
- The owner token is invalid.
- The owner session has expired.
- The owner account is inactive.
- The requested member does not exist.
- A six-digit code is invalid.
- A temporary-code expiration date is invalid.

Family and temporary codes must never be stored as readable digits.

Each code will be stored using:

- A unique random salt.
- A secure keyed hash.
- No readable copy of the original code.

The owner dashboard must never display an existing code from the database.

When changing a code, the owner enters a new six-digit code and confirms it.

---

## 3. Family Member Management

The Confidential dashboard will display a protected member list containing:

- Member name.
- Owner status.
- Active or inactive access.
- Logging enabled or disabled.
- Member type.
- Date created.
- Date last updated.

Owner actions:

- Add member.
- Edit member name.
- Change access code.
- Activate access.
- Deactivate access.
- Enable logging.
- Disable logging.

Steve’s account will remain protected from accidental deletion.

Steve’s normal logging setting will remain off unless Test Logging is deliberately enabled.

---

## 4. Secure Six-Digit Code Changes

A family code must:

- Contain exactly six digits.
- Contain numbers only.
- Not be blank.
- Be entered twice when changed.
- Match the confirmation entry.

After a successful code change:

- A new random salt is created.
- A new hash is stored.
- The old hash is replaced.
- The readable code is immediately cleared from the page.
- The owner receives a success message.

The dashboard will not reveal whether another member already uses the same code.

---

## 5. Temporary Visitor Codes

Temporary visitor codes will support:

- A visitor name or description.
- A secure six-digit code.
- A required expiration date and time.
- Unlimited logins until expiration.
- Standard visit and page-history logging.
- Early deactivation by the owner.
- Automatic rejection after expiration.

Temporary-code status will show:

- Active.
- Expired.
- Deactivated.

Expired and deactivated codes will remain visible to the owner for historical reference unless later deleted through a separate approved feature.

---

## 6. Owner Dashboard Sections

The Confidential dashboard will contain these protected sections:

### Visitor Records

- Total visits.
- Recent visits.
- Visit details.
- Page-history details.
- Manual refresh.

### Family Members

- Protected member list.
- Add-member form.
- Edit-member controls.
- Activate/deactivate controls.
- Logging controls.
- Secure code-change form.

### Temporary Visitors

- Create temporary visitor code.
- Set expiration.
- View active and expired temporary codes.
- Deactivate a temporary code early.

### Security Messages

Connection failures must say:

> The security service could not be reached. Stored records were not changed.

The dashboard must not display:

> No logged family visits are currently stored.

when the real problem is a network, CORS, or Worker connection failure.

---

## 7. Planned Cloudflare Worker Endpoints

Owner-only endpoints to add:

- `POST /owner-members`
- `POST /owner-member-create`
- `POST /owner-member-update`
- `POST /owner-member-code`
- `POST /owner-member-status`
- `POST /owner-member-logging`
- `POST /owner-temporary-codes`
- `POST /owner-temporary-code-create`
- `POST /owner-temporary-code-deactivate`

Every endpoint will:

- Validate the owner token.
- Validate all submitted data.
- Use parameterized D1 queries.
- Return clear success or error responses.
- Avoid returning password hashes, salts, or readable codes.

---

## 8. Database Planning

The existing `members` table will continue to hold permanent family members.

A new temporary-access table is planned with fields similar to:

- ID.
- Display name.
- Code salt.
- Code hash.
- Active status.
- Expiration time.
- Created time.
- Updated time.
- Deactivated time.
- Creator member ID.

Any database change must be created in the test D1 database first.

A restore bookmark or backup checkpoint must be recorded before applying a schema change.

---

## 9. Storm-Safe Development Workflow

Because of possible power outages:

1. Work only on `visitor-log-test`.
2. Complete one safe functional block at a time.
3. Save and commit after each completed block.
4. Check the GitHub Actions green mark after every commit.
5. Deploy Worker changes after each validated Worker block.
6. Record the active Worker deployment version.
7. Keep `main` untouched.
8. Do not merge until the full system passes end-to-end testing.

---

## 10. Planned Development Blocks

### Block A — Worker Member Listing

- Add protected member-list endpoint.
- Return safe member information only.
- Test valid and invalid owner sessions.
- Deploy and record Worker version.

### Block B — Member Creation and Editing

- Add member.
- Edit display name.
- Activate or deactivate access.
- Enable or disable logging.
- Protect Steve’s owner account.

### Block C — Secure Code Changes

- Validate six-digit codes.
- Generate salt and hash.
- Replace stored credential safely.
- Clear readable form fields.

### Block D — Temporary Visitor Codes

- Add database table.
- Create temporary codes.
- Enforce expiration.
- Allow early deactivation.
- Record normal visit history.

### Block E — Confidential Dashboard Interface

- Add member-management interface.
- Add temporary-code interface.
- Correct misleading fetch-failure wording.
- Connect forms to protected Worker endpoints.

### Block F — Complete End-to-End Test

- Owner login.
- Add a test member.
- Change the test member’s code.
- Log in as the test member.
- Record multiple page entries.
- Log out.
- Verify the visit in Confidential.
- Deactivate the test member.
- Verify login is rejected.
- Create a temporary visitor code.
- Test before and after expiration.
- Remove temporary local-file access.
- Confirm downloaded files are blocked.

---

## 11. Production Requirements

Before any move to `main`:

- Replace all temporary test codes.
- Confirm Steve’s logging is off.
- Confirm no readable credentials exist in GitHub.
- Confirm no readable credentials exist in Worker code.
- Confirm temporary local origin `"null"` is absent.
- Confirm only approved website origins are allowed.
- Confirm private files are not directly exposed through public GitHub paths.
- Complete a final backup.
- Complete a final test on desktop and phone.
- Receive owner approval before merge.

---

## 12. Current Verified Status

Completed and verified:

- Secure six-digit family login.
- Hashed family-code verification.
- Visit creation.
- Page-history logging.
- Manual logout.
- Idle-warning design.
- Owner password stored as a salt and hash.
- Secure owner login.
- Owner session validation.
- Owner visit summary.
- Owner visit details.
- Local-file access removed after testing.
- Downloaded local pages blocked from Cloudflare.
- `main` remains unchanged.

Next implementation block:

**Cloudflare Worker owner member-listing endpoint.**
