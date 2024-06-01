'use strict'

// Implements Brad Hill's Double HMAC pattern from
// https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2011/february/double-hmac-verification/.
// The approach is similar to the node's native implementation of timing safe buffer comparison that will be available on v6+.
// https://github.com/nodejs/node/issues/3043
// https://github.com/nodejs/node/pull/3073

import crypto from 'crypto'

/**
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/

function bufferEqual (a, b) {
    if (a.length !== b.length) {
        return false
    }

    // `crypto.timingSafeEqual` was introduced in Node v6.6.0
    // <https://github.com/jshttp/basic-auth/issues/39>
    if (crypto.timingSafeEqual) {
        return crypto.timingSafeEqual(a, b)
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false
        }
    }

    return true
}

export function timeSafeCompare (a, b) {
    const sa = String(a)
    const sb = String(b)
    const key = crypto.randomBytes(32)
    const ah = crypto.createHmac('sha256', key).update(sa).digest()
    const bh = crypto.createHmac('sha256', key).update(sb).digest()

    return bufferEqual(ah, bh) && a === b
}

export default timeSafeCompare

/**
 * Serialize data into a cookie header.
 *
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 *
 * serialize('foo', 'bar', { httpOnly: true })
 *   => "foo=bar; httpOnly"
 *
 * @param {string} name
 * @param {string} val
 * @param {object} [opts]
 * @return {string}
 */
export function serializeCookie (name:string, val:string, opts?:Partial<{
    encode:(string)=>string;
    maxAge;
    domain;
    path;
    expires;
    httpOnly:boolean;
    secure;
    partitioned;
    priority;
    sameSite;
}>):string {
    const enc = opts?.encode || encode

    if (typeof enc !== 'function') {
        throw new TypeError('option encode is invalid')
    }

    if (!fieldContentRegExp.test(name)) {
        throw new TypeError('argument name is invalid')
    }

    const value = enc(val)

    if (value && !fieldContentRegExp.test(value)) {
        throw new TypeError('argument val is invalid')
    }

    let str = name + '=' + value

    if (opts?.maxAge != null) {
        const maxAge = opts?.maxAge - 0

        if (isNaN(maxAge) || !isFinite(maxAge)) {
            throw new TypeError('option maxAge is invalid')
        }

        str += '; Max-Age=' + Math.floor(maxAge)
    }

    if (opts?.domain) {
        if (!fieldContentRegExp.test(opts?.domain)) {
            throw new TypeError('option domain is invalid')
        }

        str += '; Domain=' + opts?.domain
    }

    if (opts?.path) {
        if (!fieldContentRegExp.test(opts?.path)) {
            throw new TypeError('option path is invalid')
        }

        str += '; Path=' + opts?.path
    }

    if (opts?.expires) {
        const expires = opts?.expires

        if (!isDate(expires) || isNaN(expires.valueOf())) {
            throw new TypeError('option expires is invalid')
        }

        str += '; Expires=' + expires.toUTCString()
    }

    if (opts?.httpOnly) {
        str += '; HttpOnly'
    }

    if (opts?.secure) {
        str += '; Secure'
    }

    if (opts?.partitioned) {
        str += '; Partitioned'
    }

    if (opts?.priority) {
        const priority = typeof opts?.priority === 'string'
            ? opts?.priority.toLowerCase()
            : opts?.priority

        switch (priority) {
            case 'low':
                str += '; Priority=Low'
                break
            case 'medium':
                str += '; Priority=Medium'
                break
            case 'high':
                str += '; Priority=High'
                break
            default:
                throw new TypeError('option priority is invalid')
        }
    }

    if (opts?.sameSite) {
        const sameSite = typeof opts?.sameSite === 'string' ?
            opts?.sameSite.toLowerCase() :
            opts?.sameSite

        switch (sameSite) {
            case true:
                str += '; SameSite=Strict'
                break
            case 'lax':
                str += '; SameSite=Lax'
                break
            case 'strict':
                str += '; SameSite=Strict'
                break
            case 'none':
                str += '; SameSite=None'
                break
            default:
                throw new TypeError('option sameSite is invalid')
        }
    }

    return str
}

/**
 * URL-encode value.
 *
 * @param {string} val
 * @returns {string}
 */

function encode (val:string):string {
    return encodeURIComponent(val)
}

const __toString = Object.prototype.toString

/**
 * Determine if value is a Date.
 *
 * @param {*} val
 */
function isDate (val:any):boolean {
    return __toString.call(val) === '[object Date]' ||
      val instanceof Date
}
