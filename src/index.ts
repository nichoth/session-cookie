import crypto from 'crypto'
import {
    HandlerEvent,
    HandlerContext,
    HandlerResponse
} from '@netlify/functions'
import stringify from 'json-canon'
import { timeSafeCompare as compare, serializeCookie } from './util.js'

/**
 * Value to be used as a default for the "Max-Age" attribute of the session cookie.
 */
const SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT = (60 * 60 * 24 * 7)

/**
 * Name to be used for the session cookie if none provided.
 */
export const SESSION_COOKIE_NAME_DEFAULT = 'session'

/**
 * Length of the signature digest, in characters.
 * Used to separate signature from data in the raw session cookie.
 */
const SIGNATURE_DIGEST_LENGTH = 27

export function getCookiesFromEvent (ev:HandlerEvent):string[]|undefined {
    // Grab cookies from header
    const incomingCookies:string[]|undefined = (
        ev.multiValueHeaders.Cookie ||
        ev.multiValueHeaders.cookie
    )

    return incomingCookies
}

/**
 * This verifies that the signature in the cookie is valid.
 * Does not check expiration or other properties.
 * @returns {boolean}
 */
export function verifyCookieFromEvent (ev:HandlerEvent):boolean {
    const cookies = getCookiesFromEvent(ev)
    if (!cookies) return false

    const cookieMap:Record<string, string> = parseCookie(cookies)
    const cookieName = getCookieName()

    // Grab, validate, and parse session data from cookie
    if (cookieMap && cookieMap[cookieName]) {
        // Signature: first X characters (`SIGNATURE_DIGEST_LENGTH`), stays
        //   in base64.
        // Note: Only works because we know that all characters used for
        //   signatures are 1 byte long.
        const signature = cookieMap[cookieName].substring(
            0,
            SIGNATURE_DIGEST_LENGTH
        )

        // Data: everything after the signature. Needs to be decoded from base64,
        // parsed from JSON.
        // index sig_deg_lenth -> end
        let data:string = cookieMap[cookieName].substring(SIGNATURE_DIGEST_LENGTH)
        data = Buffer.from(data, 'base64').toString('utf-8')

        // if signature matches, return true, because it is valid
        // (key, data, signature)
        return verify(getSecretKey(), data, signature)
    }

    return false
}

/**
 * Given an encoded signature + data string, return if the signature is
 * valid for the data.
 * @param {string} session The encoded session cookie
 * @returns {boolean}
 */
export function verifySessionString (session:string):boolean {
    const signature = session.substring(
        0,
        SIGNATURE_DIGEST_LENGTH
    )

    let data:string = session.substring(SIGNATURE_DIGEST_LENGTH)
    data = Buffer.from(data, 'base64').toString('utf-8')

    return verify(getSecretKey(), data, signature)
}

/**
 * This depends on the signature being a specific length.
 *
 * The cookie is serialized like `signature + base64(JSON.stringify(data))`
 */
export function parseSession<T=object> (encodedSession:string):T {
    const data:string = encodedSession.substring(SIGNATURE_DIGEST_LENGTH)
    const buf = Buffer.from(data, 'base64')
    const str = buf.toString('utf-8')
    return JSON.parse(str)
}

/**
 * Parse a cookie header.
 *
 * Parse the given cookie header string into an object.
 * The object has the various cookies as names => values
 */
export function parseCookie (
    incomingCookies:string[],
    _decode?:(s:string)=>string
):Record<string, string> {
    const dec = _decode || decode

    const parsedCookies = incomingCookies.map(cookie => {
        const parsed = cookie.split(';').map(str => {
            const split = str.trim().split('=')
            return split
        }).reduce((acc, val) => {
            acc[val[0]] = tryDecode(val[1], dec) ?? true
            return acc
        }, {})

        return parsed
    })

    const reduced = parsedCookies.reduce((acc, val) => {
        return { ...acc, ...val }
    }, {})

    return reduced
}

/**
 * Returns the name to be used for the session cookie.
 *
 * Defaults to the value of `SESSION_COOKIE_NAME_DEFAULT`.
 * Can be overridden via `env.SESSION_COOKIE_NAME`.
 * Will throw if `SESSION_COOKIE_NAME` is set but contains anything else
 * than ASCII characters (excluding whitespace).
 *
 * @returns {string} - Name used for the session cookie
 */
function getCookieName ():string {
    let name = SESSION_COOKIE_NAME_DEFAULT
    const nameFromEnv = process.env.SESSION_COOKIE_NAME

    // Try to grab session cookie name from `SESSION_COOKIE_NAME` if available.
    if (typeof nameFromEnv === 'string') {
    const regex = /[A-Za-z0-9\!\#\$\%\&\'\*\+\-\.\^\_\`\|\~]+/g // eslint-disable-line
        const check = nameFromEnv.match(regex)

        if (nameFromEnv.length < 1) {
            throw new Error('"SESSION_COOKIE_NAME" cannot be an empty string.')
        }

        if (check instanceof Array !== true || check[0] !== nameFromEnv) {
            throw new Error('"SESSION_COOKIE_NAME" must only contain ASCII ' +
                'characters and no whitespace.')
        }

        name = nameFromEnv
    }

    return name
}

/**
 * URL-decode string value. Optimized to skip native call when no %.
 *
 * @param {string} str
 * @returns {string}
 */
function decode (str:string):string {
    return str.indexOf('%') !== -1 ?
        decodeURIComponent(str) :
        str
}

export function createCookie (newSessionData:object, secretKey?:string) {
    const key = secretKey || getSecretKey()
    // Sign session data and add it to `Set-Cookie`.
    const sessionAsJSON = stringify(newSessionData)
    // session=[signature][data];

    // sig + base64SessionValue
    const cookieValue = sign(sessionAsJSON, key) +
        Buffer.from(sessionAsJSON, 'utf-8').toString('base64')

    return cookieValue
}

/**
 * Checks and returns the secret key to be used to sign the session cookie.
 * Reads from `env.SESSION_COOKIE_SECRET`.
 * The key must be at least 32 bytes long.
 */
function getSecretKey ():string {
    const secret = process.env.SESSION_COOKIE_SECRET
    let secretLength = 0

    if (!secret || typeof secret !== 'string') {
        throw new Error('"SESSION_COOKIE_SECRET": No secret key provided.')
    }

    secretLength = Buffer.byteLength(secret, 'utf-8')
    if (secretLength < 32) {
        throw new Error('"SESSION_COOKIE_SECRET": The secret key must be at ' +
            'least 32 bytes long; (' + secretLength + ' given).')
    }

    return secret
}

/**
 * Compare a given signature to a new signature created with the same data.
 *
 * @param {string} key The key
 * @param {Buffer|string} data The data to sign
 * @param {string} signature The signature to check
 * @returns {boolean} True or false, if the signature is valid or not
 */
export function verify (
    key:string,
    data:Buffer|string,
    signature:string
):boolean {
    return compare(signature, sign(data, key))
}

/**
 * Try decoding a string using a decoding function.
 *
 * @param {string} str
 * @param {function} decode
 * @private
 */
function tryDecode (str:string, decode:(s:string)=>string):string {
    try {
        return decode(str)
    } catch (err) {
        return str
    }
}

/**
 * Patch the response object with signed cookie data.
 *
 * @param {HandlerResponse} response The response to merge the headers with
 * @param {HandlerContext} ctx The context for the lambda function
 * @returns {Record<string, string>}
 */
export function setCookie (
    response:HandlerResponse,
    ctx:HandlerContext,
    newData:Record<string, string>
):HandlerResponse {
    if (!response.multiValueHeaders) response.multiValueHeaders = {}
    if (!response.multiValueHeaders['Set-Cookie']) {
        response.multiValueHeaders['Set-Cookie'] = []
    }

    const session = getSession(ctx)
    const newSession = { ...session, ...newData }

    // Merge any value that may be in `headers['Set-Cookie']` to
    // `response.multiValueHeaders['Set-Cookie']`.
    if (response.headers && response.headers['Set-Cookie']) {
        (response.multiValueHeaders['Set-Cookie'] as (string|number|true)[])
            .push(response.headers['Set-Cookie'])

        delete response.headers['Set-Cookie']
    }

    // Sign session data and add it to `Set-Cookie`.
    // this is the signature and data, concated and encoded as base64
    const cookieValue = createCookie(newSession, getSecretKey())

    const cookieName = getCookieName();

    (response.multiValueHeaders['Set-Cookie'] as (string|boolean|void)[])
        .push(serializeCookie(cookieName, cookieValue, getCookieOptions()))

    return response
}

/**
 * Sign the given data and return the signature as a string.
 *
 * @returns {string}
 */
export function sign (data:Buffer|string, key:string, opts?:Partial<{
    algorithm:'sha1'|'sha256'|'sha512';
    encoding:crypto.BinaryToTextEncoding;
}>):string {
    const algorithm = opts?.algorithm || 'sha1'
    const encoding = opts?.encoding || 'base64'

    return crypto
        .createHmac(algorithm, key)
        .update(data).digest(encoding)
        .replace(/\/|\+|=/g, (x) => {
            return ({ '/': '_', '+': '-', '=': '' })[x] as string
        })
}

/**
 * Returns a reference to the `context.clientContext.sessionCookieData` object.
 * This object contains data for the current session, which can be read and edited.
 *
 * @param {Object} context - From the Lambda handler function.
 * @returns {Object} - Reference to the session data object.
 */
export function getSession (context:HandlerContext):Record<string, string> {
    if (!context || !context.clientContext) {
        throw new Error('`getSession()` requires a valid Lambda `context` ' +
            'object as an argument.')
    }

    let session = context.clientContext?.sessionCookieData

    // Initialize `sessionCookieData` if it doesn't exist.
    if (session === undefined || session === null) {
        context.clientContext.sessionCookieData = {}
        session = context.clientContext.sessionCookieData
    }

    return session
}

/**
 * Builds an option object to be used by the cookie serializer.
 * All options have defaults which can be edited using environment variables.
 *
 * Environment variables available:
 * - `env.SESSION_COOKIE_HTTPONLY`:
 *   Specifies if the cookie should have the `HttpOnly` attribute.
 *   Set to "0" to remove this attribute from the cookie definition.
 * - `env.SESSION_COOKIE_SECURE`:
 *   Specifies if the cookie should have the `Secure` attribute.
 *   Set to "0" to remove this attribute from the cookie definition.
 * - `env.SESSION_COOKIE_SAMESITE`:
 *   Will specify the value for the `SameSite` attribute for the cookie.
 *   Can be "Strict", "None" or "Lax" (default).
 * - `env.SESSION_COOKIE_MAX_AGE_SPAN`:
 *   Specifies, in second, how long the cookie should be valid for.
 *   Defaults to 7 days.
 * - `env.SESSION_COOKIE_DOMAIN`:
 *   If set, will specify a value for the `Domain` attribute for the cookie.
 * - `env.SESSION_COOKIE_PATH`:
 *   If set, will specify a value for the `Path` attribute for the cookie.
 *   Defaults to `/`.
 *
 * @returns {object} - Options object for `cookie.serialize`
 * @private
 */
function getCookieOptions () {
    // Defaults (options detail: https://github.com/jshttp/cookie#options-1)
    const options:Partial<{
        httpOnly,
        secure,
        sameSite,
        maxAge,
        path,
        domain
    }> = {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT,
        path: '/'
    }

    //
    // Use environment variables to edit defaults.
    //
    const {
        SESSION_COOKIE_HTTPONLY,
        SESSION_COOKIE_SECURE,
        SESSION_COOKIE_SAMESITE,
        SESSION_COOKIE_MAX_AGE_SPAN,
        SESSION_COOKIE_DOMAIN,
        SESSION_COOKIE_PATH
    } = process.env

    // HttpOnly
    if (SESSION_COOKIE_HTTPONLY === '0') {
        delete options.httpOnly
    }

    // Secure
    if (SESSION_COOKIE_SECURE === '0') {
        delete options.secure
    }

    // SameSite
    if (['Strict', 'Lax', 'None'].includes(SESSION_COOKIE_SAMESITE!)) {
        options.sameSite = SESSION_COOKIE_SAMESITE!.toLowerCase()
    }

    // Max-Age
    if (!isNaN(parseInt(SESSION_COOKIE_MAX_AGE_SPAN!))) {
        options.maxAge = parseInt(SESSION_COOKIE_MAX_AGE_SPAN!)
    }

    // Domain
    if (SESSION_COOKIE_DOMAIN) {
        options.domain = SESSION_COOKIE_DOMAIN
    }

    // Path
    if (SESSION_COOKIE_PATH) {
        options.path = SESSION_COOKIE_PATH
    }

    return options
}

/**
 * Generates a 32-byte-long random key that can be used for signing cookies
 * using SHA-256 HMAC.
 *
 * Thanks to: https://github.com/crypto-utils/keygrip/issues/26
 *
 * @returns {string} - Random series of 32 bytes encoded in base64.
 */
export function generateSecretKey ():string {
    return crypto.randomBytes(32).toString('base64')
}
