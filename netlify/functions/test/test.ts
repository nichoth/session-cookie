import 'dotenv/config'
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions'
import {
    setCookie,
    getCookiesFromEvent,
    parseCookie,
    verifyCookieFromEvent,
    verifySessionString,
    parseSession
} from '../../../src/index.js'
import crypto from 'crypto'

export const handler:Handler = async function handler (
    ev:HandlerEvent,
    ctx:HandlerContext
) {
    const cookies = getCookiesFromEvent(ev)
    console.log('**** cookies', cookies)

    if (cookies) {
        const isOk = verifyCookieFromEvent(ev)
        console.log('**is ok???**', isOk)

        const cookieMap = parseCookie(cookies)
        console.log('**cookiemap**', cookieMap)
        const { session } = cookieMap
        const parsedSession = parseSession<{ identifier }>(session)
        console.log('**parsed session**', parsedSession)

        const isOkAsString = verifySessionString(session)
        console.log('ok from a string????', isOkAsString)

        if (!isOkAsString) {
            return { statusCode: 401 }
        }

        const { identifier } = parsedSession

        // if there is already a session, then keep using it
        if (identifier) {
            const response = {
                statusCode: 200,
                body: JSON.stringify({ hello: 'hello' })
            }

            setCookie(response, ctx, { identifier, ts: '' + Date.now() })

            return response
        }
    }

    // __the existing session ID__
    // 39f8a712ad8e6816567e61d065f208e4

    const response = {
        statusCode: 200,
        body: JSON.stringify({ hello: 'hello' })
    }

    const identifier = crypto.randomBytes(16).toString('hex')

    // setCookie will sign the given input data
    setCookie(response, ctx, {
        identifier
    })

    return response
}
