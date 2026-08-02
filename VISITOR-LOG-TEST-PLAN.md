# Steve & Anita Visitor Log Test Plan

## Purpose

Build and test a private family access and visitor logging system without changing the live website on the main branch.

## Approved Features

- Each family member will have an individual six-digit access code.
- Steve will be the owner.
- Steve's visits will not be recorded unless Test Logging is turned on.
- Family members can be added, renamed, deactivated, reactivated, or assigned a new code.
- Failed access attempts will be recorded.
- The actual incorrect digits entered will never be saved.
- Each visit will record the login date and time.
- Each visit will record pages viewed and the order visited.
- Approximate time spent on each page will be recorded.
- General device type will be recorded:
  - Computer
  - Phone
  - Tablet
- Records will be retained until Steve deletes them.
- Full IP addresses will not be used to identify family members.

## Idle Logout

- After 15 minutes without activity, show an "Are you still there?" warning.
- Allow 2 additional minutes for the visitor to press Continue.
- If there is no response, end the visit and log the visitor out.
- Record the visit ending reason as Idle Timeout.

## Test Accounts

The first test will contain only:

1. Steve
   - Owner account
   - Logging disabled by default
   - Test Logging switch available

2. Test Family Member
   - Standard family account
   - Logging enabled

No real family access codes will be placed in this GitHub file.

## Security Rules

- Real access codes must never be stored in public HTML or JavaScript.
- Real access codes must never be committed to GitHub.
- Codes will be verified by a Cloudflare Worker.
- Codes will be stored only in protected form.
- Visit records will be stored in a private Cloudflare D1 database.
- Confidential records will require an authenticated owner session.
- Confidential documents will eventually be moved to protected storage.

## Test Stages

### Stage 1

Create a separate test page and browser-side test framework.

### Stage 2

Create the Cloudflare Worker and D1 test database.

### Stage 3

Test login, visit tracking, idle logout, and Steve exclusion.

### Stage 4

Build the private owner administration and visitor-log display.

### Stage 5

Test on computer and phone.

### Stage 6

Only after Steve approves the completed test, prepare controlled changes for the live main branch.

## Live Website Protection

The main branch and live website must remain unchanged throughout the initial testing process.
