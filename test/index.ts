import { test } from '@bicycle-codes/tapzero'
import { sign, verify } from '../src/index.js'

const SECRET_KEY = '/pQCobVcOc+ru0WVTx24+MlCL7fIAPcPTsgGqXvV8M0='

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
