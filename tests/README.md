# Running Tests

## Offline authentication polling tests

These tests use a fresh temporary Chromium profile and offline `data:` fixtures. They do not require a WhatsApp account, phone, or test credentials, and do not send messages.

```bash
npm run test-single -- tests/client-auth-polling.js
```

Puppeteer uses its installed browser by default. To use an existing Chromium executable:

```bash
PUPPETEER_EXECUTABLE_PATH="/path/to/chromium" npm run test-single -- tests/client-auth-polling.js
```

The fixtures suppress animation callbacks and exercise real Client initialization. They cover delayed Debug/socket readiness, authentication timeouts, cancellation, and error propagation. Each browser and its temporary profile are removed after the test.

## Authenticated integration tests

The integration tests require an authenticated WhatsApp Web session, as well as an additional phone that you can send messages to.

This can be configured using the following environment variables:

- `WWEBJS_TEST_CLIENT_ID`: `clientId` to use for local file based authentication (required for authenticated tests).
- `WWEBJS_TEST_REMOTE_ID`: A valid WhatsApp ID that you can send messages to, e.g. `123456789@c.us`. It should be different from the ID used by the provided session (required).

You can create a `.env` file in the root directory with these variables. See `.env.example` for a template.

To run the tests:

```bash
npm test
```
