# Running Tests

## Account-free navigation lifecycle tests

These tests use stubbed browser pages and authentication hooks. They do not
launch a browser, read account configuration, or send messages:

```bash
npm run test-single -- tests/client-navigation.js
```

They cover stale navigation handlers during destroy/reinitialization, listener
ownership, main-frame and existing-store guards, and logout behavior.

## WhatsApp integration tests

These tests require an authenticated WhatsApp Web session, as well as an additional phone that you can send messages to.

This can be configured using the following environment variables:

- `WWEBJS_TEST_CLIENT_ID`: `clientId` to use for local file based authentication (required for authenticated tests).
- `WWEBJS_TEST_REMOTE_ID`: A valid WhatsApp ID that you can send messages to, e.g. `123456789@c.us`. It should be different from the ID used by the provided session (required).

You can create a `.env` file in the root directory with these variables. See `.env.example` for a template.

To run the tests:

```bash
npm test
```
