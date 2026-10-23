// Server testlari yuklovchisi — scripts/testing/fake-modules.mjs
import { register } from 'node:module'
register('./fake-modules.mjs', import.meta.url)
