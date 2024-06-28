import 'dotenv/config'
import { Handler, HandlerEvent } from '@netlify/functions'
import { getCookiesFromEvent } from '../../../src'

export const handler:Handler = async function handler (
    ev:HandlerEvent,
) {
    const cookies = getCookiesFromEvent(ev)
    console.log('****delete these cookies*******', cookies)
    return { statusCode: 200 }
}
