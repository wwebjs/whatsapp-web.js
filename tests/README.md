# Tests

The test suite is split into two tiers:

- [`tests/unit`](./unit) — fast, hermetic tests that don't require Chromium, a network connection, or a WhatsApp session. Run on every CI build.
- [`tests/integration`](./integration) — end-to-end tests that drive a real browser against WhatsApp Web. They require an authenticated session and a second phone number, so they are opt-in (see [`integration/README.md`](./integration/README.md)).

## Commands

```bash
npm test                  # unit tests only (default)
npm run test:unit         # unit tests
npm run test:integration  # integration tests (requires env vars, see integration/README.md)
```
