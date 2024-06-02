import 'dotenv/config'
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions'
import {
    setCookie,
    getCookiesFromEvent,
    parseCookie,
    verifyCookieFromEvent,
    parseSession
} from '../../../src/index.js'
import crypto from 'crypto'

export const handler:Handler = async function handler (
    ev:HandlerEvent,
    ctx:HandlerContext
) {
    if (ev.httpMethod !== 'GET') return { statusCode: 405 }

    const cookies = getCookiesFromEvent(ev)
    // if (!cookies) throw Error('not cookies!')
    if (cookies) {
        console.log('**cookie from event**', cookies)
        const parsed = parseCookie(cookies)
        console.log('**parsed**', parsed)

        console.log('parsed.session', parsed.session)
        console.log('**session parsed**', parseSession(parsed.session))
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify({ hello: 'hello' })
    }

    const isOk = verifyCookieFromEvent(ev)
    console.log('**is ok???**', isOk)

    const identifier = crypto.randomBytes(16).toString('hex')

    // setCookie will sign the given input data
    setCookie(response, ctx, {
        identifier
    })

    return response
}
