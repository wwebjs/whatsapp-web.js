# Integration Tests

These tests drive a real Chromium instance and require an authenticated WhatsApp Web session, plus a second phone number that you can send messages to. They are **not** run in CI by default.

For fast tests that don't require Chrome or a phone, see [`tests/unit`](../unit).

## Setup

Set the following environment variables (a `.env` file at the repo root is supported):

- `WWEBJS_TEST_CLIENT_ID` — `clientId` used by `LocalAuth` to locate the saved session.
- `WWEBJS_TEST_REMOTE_ID` — a valid WhatsApp ID you can send messages to, e.g. `123456789@c.us`. Must be different from the account the session belongs to.

## Run

```bash
npm run test:integration
```

To run a single file:

```bash
npx mocha tests/integration/structures/message.js --timeout 5000
```
