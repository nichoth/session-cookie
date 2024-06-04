import ky from 'ky'
import Debug from '@bicycle-codes/debug'
const debug = Debug()

const res = await ky.post('/api/test')

// @ts-expect-error dev
window.res = res

debug('the response', res)
