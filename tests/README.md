# Running Tests

The call and navigation regression tests do not require a browser or account:

```bash
npx mocha tests/call.js tests/call-injected.js tests/web-calling.js tests/framenavigated.js --timeout 5000
```

The injected call tests execute the browser helpers against simulated WhatsApp
modules, including the distinction between an active call and failure history.
Live call validation needs an initialized calling stack. The experimental
`forceWebCalling: true` option can enable the local gate when it is disabled for
the session; see the fork's README. A successful login alone does not establish
call availability, and calls reject explicitly when the stack is unavailable.

These tests require an authenticated WhatsApp Web session, as well as an additional phone that you can send messages to.

This can be configured using the following environment variables:

- `WWEBJS_TEST_CLIENT_ID`: `clientId` to use for local file based authentication (required for authenticated tests).
- `WWEBJS_TEST_REMOTE_ID`: A valid WhatsApp ID that you can send messages to, e.g. `123456789@c.us`. It should be different from the ID used by the provided session (required).

You can create a `.env` file in the root directory with these variables. See `.env.example` for a template.

To run the tests:

```bash
npm test
```
