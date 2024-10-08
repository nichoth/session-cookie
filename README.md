# session cookie

[![types](https://img.shields.io/npm/types/@nichoth/session-cookie?style=flat-square)](./src/index.ts)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](https://github.com/nichoth/session-cookie/blob/0d91336aa9c73f28556d620a75e2564765073457/package.json#L57)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE)


Use signed data as a cookie.

* Serialize the cookie in a concise format
* Parse the cookie
* Verify the cookie's signature

This is designed to work with lamdba functions, eg [via netlify](https://docs.netlify.com/functions/overview/). The examples assume such as the environment.

## install

```bash
npm i -S @nichoth/session-cookie
```

## Environment variables
The session cookie can be configured through environment variables.

### Required
| Name | Description |
| --- | --- |
| `SESSION_COOKIE_SECRET` | Used to sign and validate the session cookie. Must be at least 32 bytes long. See [_"Generate a secret key"_](#generate-a-secret-key) for more information. |

## Optional
| Name | Description |
| --- | --- |
| `SESSION_COOKIE_NAME` | Name used by the session cookie. Must only contain ASCII-compatible characters and no whitespace. Defaults to `"session"`. |
| `SESSION_COOKIE_HTTPONLY` | The session cookie bears the `HttpOnly` attribute by default. Set this environment variable to `"0"` to remove it. | 
| `SESSION_COOKIE_SECURE` | The session cookie bears the `Secure` attribute by default. Set this environment variable to `"0"` to remove it. | 
| `SESSION_COOKIE_SAMESITE` | Can be `"Strict"`, `"None"` or `"Lax"`. Defaults to `"Lax"` if not set. | 
| `SESSION_COOKIE_MAX_AGE_SPAN` | Specifies, in second, how long the cookie should be valid for. Defaults to `604800` _(7 days)_ if not set. |
| `SESSION_COOKIE_DOMAIN` | Can be used to specify a domain for the session cookie. |
| `SESSION_COOKIE_PATH` | Can be used to specify a path for the session cookie. Defaults to `/` if not set. |

---

## Generate a secret key
Session cookies are signed using [HMAC SHA256](https://en.wikipedia.org/wiki/HMAC), which requires using a secret key of at least 32 bytes of length.
This one-liner can be used to generate a random key, once this library is installed.

### after installing as a dependency

```bash
node -e "console.log(require('@nichoth/session-cookie').generateSecretKey())"
```

## API

```js
import {
    sign,
    verify,
    parseCookie,
    parseSession,
    verifySessionString,
    setCookie,
    getCookiesFromEvent,
    verifyCookieFromEvent,
} from '@nichoth/session-cookie'
```

### `getCookiesFromEvent(event)`

Get the cookies from a lambda event

```js
import { HandlerEvent } from '@netlify/functions'
function getCookiesFromEvent (ev:HandlerEvent):string[]|undefined
```

### `verifyCookieFromEvent(event)`
Check if the signature in the `session` cookie is valid.

```js
import { HandlerEvent } from '@netlify/functions'
function verifyCookieFromEvent (ev:HandlerEvent):boolean
```

### `parseCookie(incomingCookies, options)`

```js
function parseCookie (incomingCookies:string[], options?:Partial<{
    decode:(s:string)=>string
}>):Record<string, string>
```

Parse the given cookie strings into an object.

### `parseSession(encodedSession)`

```js
function parseSession<T=object> (encodedSession:string):T
```

Parse the given session string. This depends on the signature being a
specific length.

#### `parseSession` example
```js
parseSession<{ identifier, ts }>(session)
// => { identifier: '39f8a712ad8e6816567e61d065f208e4', ts: '1717387248677' }
```

### `verifySessionString(session)`
```js
function verifySessionString (session:string):boolean
```

Verify the given `session` in the cookie.

### `setCookie (response, context, data)`

```js
import {
    HandlerContext,
    HandlerResponse
} from '@netlify/functions'

function setCookie (
    response:HandlerResponse,
    ctx:HandlerContext,
    newData:Record<string, string>
):HandlerResponse
```

Patch the given response object with a signed cookie with a `session` key.
Call this from within a lambda function.

This will add several properties to the cookies, in addition to the
`session` key.

```js
// Indicates the number of seconds until the cookie expires.
// default is 7 days
const SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT = (60 * 60 * 24 * 7)

{
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT,
    path: '/'
}
```

## The serialized cookie

The cookie is a string, `base64(signature) + base64(JSON.stringify(data))`.

```
'session=nYiMr6Ya_83iC-XN-nmxOEk6AE0eyJpZGVudGlmaWVyIjoiZjhjNWZkNzM4MDcwMTlkNTUzZTc2ZjY1YzBhYTdlZjIifQ%3D%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax'
```

## example
This library will add a `session` property to the cookies. `session` is
an object and signature of that object, serialized in a particular way.

### Update an existing cookie

If the existing cookie is valid, then create a new cookie with
the same data but an updated timestamp.

```js
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions'
import {
    parseSession,
    setCookie,
    parseCookie,
    getCookiesFromEvent,
    verifySessionString,
    SESSION_COOKIE_NAME_DEFAULT
} from '@nichoth/session-cookie'

export const handler:Handler = async function handler (
    ev:HandlerEvent,
    ctx:HandlerContext
) {
    const cookies = getCookiesFromEvent(ev)
    const cookieMap = parseCookie(cookies)
    // default name is 'session'
    const session = cookieMap[SESSION_COOKIE_NAME_DEFAULT]

    // check the signature
    if (!verifySessionString(session)) {
        return { statusCode: 403 }
    }

    // this depends on the signature being a specific length,
    // because of the way that the cookie is serialized
    const parsedSession = parseSession<{ identifier, ts }>(session)

    // here the session data includes an identifier
    if (parsedSession && parsedSession.identifier) {
        // a cookie exists already
        const response = {
            statusCode: 200,
            body: JSON.stringify({ hello: 'hello' })
        }

        // update it with a new timestamp
        // this will create a new cookie and sign it with the secret key
        setCookie(response, ctx, { ...parsedSession, ts: '' + Date.now() })

        return response
    }

    setCookie(response, ctx, { identifier, ts: '' + Date.now() })
}
```

### create a new cookie

```js
import crypto from 'crypto'
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions'
import { setCookie } from '@nichoth/session-cookie'

export const handler:Handler = async function handler (
    ev:HandlerEvent,
    ctx:HandlerContext
) {
    const response = {
        statusCode: 200,
        body: JSON.stringify({ hello: 'hello' })
    }

    // we are creating a new user ID here
    const identifier = crypto.randomBytes(16).toString('hex')

    // this will create a new cookie and sign it with the secret key
    setCookie(response, ctx, { identifier, ts: '' + Date.now() })

    // response has a cookie
    return response
}
```

### serialization

The cookie is a string, `base64(signature) + base64(JSON.stringify(data))`.

```js
const cookieValue = sign(sessionAsJSON, key) +
    Buffer.from(sessionAsJSON, 'utf-8').toString('base64')
```

```
'session=nYiMr6Ya_83iC-XN-nmxOEk6AE0eyJpZGVudGlmaWVyIjoiZjhjNWZkNzM4MDcwMTlkNTUzZTc2ZjY1YzBhYTdlZjIifQ%3D%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax'
```

### check the cookies server-side

This happens in a lambda function.

```js
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions'
import {
    verifyCookieFromEvent
    getCookiesFromEvent,
    SESSION_COOKIE_NAME_DEFAULT,
    verifySessionString,
    parseSession
} from '@nichoth/session-cookie'

export const handler:Handler = async function handler (
    ev:HandlerEvent,
    ctx:HandlerContext
) {
    const cookies = getCookiesFromEvent(ev)

    // if there is an incoming cookie, verify it
    if (cookies) {
        const cookieMap = parseCookie(res.headers.getSetCookie())
        const session = cookieMap[SESSION_COOKIE_NAME_DEFAULT]

        // can look at the session data
        const parsedSession = parseSession<{ identifier }>(session)

        // check the session string
        const isSessionOk = verifySessionString(session)
        if (!isSessionOk) return { statusCode: 401 }

        // or, pass in the event
        const isOk = verifyCookiesFromEvent(ev)
        if (!isOk) return { statusCode: 401 }
    } else {
        // there is no cookie here
        return { statusCode: 401 }
    }

    // ... the rest of the function ...
}
```

## develop

I haven't made fully automated tests. To test this, start the local lambda server in one terminal:

```bash
npm run fns
```

Then run the tests in a second terminal:

```bash
npm test
```

Also, open the page [http://localhost:9999/.netlify/functions/test](http://localhost:9999/.netlify/functions/test) to test in a real browser. This is more realistic because cookies will be preserved across page refreshes.

## credits

Thanks [@matteocargnelutti](https://github.com/matteocargnelutti) for publishing [netlify-functions-session-cookie](https://github.com/matteocargnelutti/netlify-functions-session-cookie), which informed this module.
