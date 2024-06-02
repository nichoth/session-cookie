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
test('call netlify function', async t => {
    const res = await ky.get(apiPath + '/test', {})

    // this is pretending to be a browser,
    // so we are not allowed to set cookies here

    const parsedCookie = parseCookie(res.headers.getSetCookie())
    const session = parseSession<{ identifier }>(parsedCookie.session)
    console.log('parsed cookie session, as string', parsedCookie.session)
    console.log('the session ', session)
    t.ok(verifySessionString(parsedCookie.session), 'should validate a cookie')
    t.ok(session, 'got a session')
    t.ok(session.identifier, 'should have the expected data in session')

    // t.equal(res.headers.getSetCookie()[0], 'abc=def')
})
