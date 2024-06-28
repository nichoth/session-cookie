import { test } from '@bicycle-codes/tapzero'
import ky from 'ky'
import {
    sign,
    verify,
    parseCookie,
    parseSession,
    verifySessionString
} from '../src/index.js'

const SECRET_KEY = '/pQCobVcOc+ru0WVTx24+MlCL7fIAPcPTsgGqXvV8M0='
process.env.SESSION_COOKIE_SECRET = SECRET_KEY

let sig:string
test('sign things', t => {
    sig = sign('hello', SECRET_KEY)
    t.ok(sig, 'creates a signature')
})

test('verify signature', t => {
    const isValid = verify(SECRET_KEY, 'hello', sig)
    t.ok(isValid, 'should return true for a valid signature')
})

test('verify an invalid signature', t => {
    const isValid = verify(SECRET_KEY, 'example', sig)
    t.equal(isValid, false, 'should return `false` for an invalid signature')
})

const apiPath = 'http://localhost:9999/.netlify/functions'
let cookie:string[]
test('call netlify function', async t => {
    const res = await ky.get(apiPath + '/test', {})

    cookie = res.headers.getSetCookie()
    const parsedCookie = parseCookie(cookie)
    console.log('**parsed cookie**', parsedCookie)
    const { session: _session, ..._parsed } = parsedCookie
    t.deepEqual(_parsed, {
        'Max-Age': '604800',
        Path: '/',
        HttpOnly: true,
        Secure: true,
        SameSite: 'Lax'
    }, 'The parsed cookie should have expected properties')
    const session = parseSession<{ identifier }>(parsedCookie.session)
    t.ok(verifySessionString(parsedCookie.session),
        'should verify a cookie returned from the server')
    t.ok(session.identifier, 'should have the expected data in session')
})

test('rm cookie', async t => {
    const res = await ky.get(apiPath + '/delete', {
        credentials: 'include',
        headers: {
            Cookie: cookie.join('; ')
        }
    })
    const parsedCookie = parseCookie(res.headers.getSetCookie())
    t.ok(res, 'got a response')
    t.equal(res.headers.getSetCookie().length, 0, 'should remove the cookie')
    t.equal(Object.keys(parsedCookie).length, 0,
        "parse doesn't throw; returns an empty object")
})
