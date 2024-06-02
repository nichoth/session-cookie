# session cookies

Cookies

## Environment variables and options

The session cookie can be configured through environment variables.

### Required
| Name | Description |
| --- | --- |
| `SESSION_COOKIE_SECRET` | Used to sign and validate the session cookie. Must be at least 32 bytes long. See [_"Generating a secret key"_](#generating-a-secret-key) for more information. |

---

## Generating a secret key

Session cookies are signed using [HMAC SHA256](https://en.wikipedia.org/wiki/HMAC), which requires using a secret key of at least 32 bytes of length.
This one-liner can be used to generate a random key, once the library is installed:

```bash
node -e "console.log(require('netlify-functions-session-cookie').generateSecretKey())"
```

Use the [`SESSION_COOKIE_SECRET` environment variable](#environment-variables-and-options) to give the library access to the secret key.
