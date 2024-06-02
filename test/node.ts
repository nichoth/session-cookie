import { test } from '@bicycle-codes/tapzero'
import { verifyCookieFromEvent } from '../src/index.js'

// export function verifyCookieFromEvent (ev:HandlerEvent):boolean {
test('cerify cookie from event', async t => {
    const mockEvent = { multiValueHeaders: { cookie: ['aaa', 'bbb'] } }
    const isValid = verifyCookieFromEvent()
})
