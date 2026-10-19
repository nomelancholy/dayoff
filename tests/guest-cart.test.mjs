import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const compiled = await build({
  absWorkingDir: root, entryPoints: ['app/features/cart/lib/guestCart.ts'],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['axios'],
  plugins: [{ name: 'product-api-fixture', setup(api) {
    api.onResolve({ filter: /^@\/common\/lib\/apiClient$/ }, () => ({ path: 'product-api', namespace: 'fixture' }))
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default { get: path => globalThis.__readProduct(path) }' }))
  } }],
})
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
const cart = module.exports
const id = '11111111-1111-4111-8111-111111111111'
const optionA = '22222222-2222-4222-8222-222222222222'
const optionB = '33333333-3333-4333-8333-333333333333'
let storage, product
beforeEach(() => {
  storage = new Map()
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  globalThis.window = new EventTarget()
  product = { id, name: '접시', slug: 'plate', price: 10000, isActive: true, stockQuantity: 5, images: [], options: [{ id: optionA, name: 'color', value: 'white' }, { id: optionB, name: 'color', value: 'gray' }] }
  globalThis.__readProduct = async path => { assert.equal(path, '/shop/products/' + id); return structuredClone(product) }
})
test('persists only identifiers/quantities and reloads server pricing, not tampered prices', async () => {
  await cart.addGuestCart({ productId: id, optionId: optionA, quantity: 1 })
  let persisted = JSON.parse(storage.get(cart.GUEST_CART_KEY))
  assert.deepEqual(Object.keys(persisted.items[0]).sort(), ['optionId', 'productId', 'quantity'])
  persisted.items[0].price = 1
  storage.set(cart.GUEST_CART_KEY, JSON.stringify(persisted))
  product.price = 12000
  assert.equal((await cart.fetchGuestCart())[0].product.price, 12000)
})
test('requires valid options and enforces shared stock across options and repeated additions', async () => {
  await assert.rejects(cart.addGuestCart({ productId: id, quantity: 1 }), /옵션/)
  await cart.addGuestCart({ productId: id, optionId: optionA, quantity: 2 })
  await cart.addGuestCart({ productId: id, optionId: optionB, quantity: 2 })
  await assert.rejects(cart.addGuestCart({ productId: id, optionId: optionA, quantity: 2 }), /5개/)
  assert.equal(cart.readGuestCart()[0].quantity, 2)
})
test('updates and removes rows while allowing reductions after stock falls', async () => {
  const row = await cart.addGuestCart({ productId: id, optionId: optionA, quantity: 3 })
  product.stockQuantity = 1
  await assert.rejects(cart.updateGuestCart(row.id, 4), /재고/)
  await cart.updateGuestCart(row.id, 2)
  assert.equal(cart.readGuestCart()[0].quantity, 2)
  await cart.removeGuestCart(row.id)
  assert.deepEqual(await cart.fetchGuestCart(), [])
})
test('sanitizes malformed storage and merges duplicate product-option rows', () => {
  storage.set(cart.GUEST_CART_KEY, 'invalid JSON')
  assert.deepEqual(cart.readGuestCart(), [])
  storage.set(cart.GUEST_CART_KEY, JSON.stringify({ version: 1, items: [
    { productId: id, optionId: optionA, quantity: 1 },
    { productId: id, optionId: optionA, quantity: 2 },
    { productId: '../admin', quantity: 1 },
    { productId: id, quantity: -1 },
  ] }))
  assert.equal(cart.readGuestCart().length, 1)
  assert.equal(cart.readGuestCart()[0].quantity, 3)
})
test('retains deleted products as removable unavailable rows and never treats network failure as an empty cart', async () => {
  const row = await cart.addGuestCart({ productId: id, optionId: optionA, quantity: 1 })
  globalThis.__readProduct = async () => { throw { isAxiosError: true, response: { status: 404 } } }
  const missing = await cart.fetchGuestCart()
  assert.equal(missing.length, 1)
  assert.match(cart.cartItemIssue(missing[0]), /판매/)
  globalThis.__readProduct = async () => { throw new Error('network offline') }
  await assert.rejects(cart.fetchGuestCart(), /offline/)
  await cart.removeGuestCart(row.id)
  assert.deepEqual(cart.readGuestCart(), [])
})
test('blocks checkout for changed options, sold-out products and combined quantities beyond stock', async () => {
  await cart.addGuestCart({ productId: id, optionId: optionA, quantity: 2 })
  await cart.addGuestCart({ productId: id, optionId: optionB, quantity: 2 })
  product.stockQuantity = 3
  assert.match(cart.cartSelectionIssue(await cart.fetchGuestCart()), /총수량/)
  product.options = []
  assert.match(cart.cartSelectionIssue(await cart.fetchGuestCart()), /옵션/)
  product.stockQuantity = 0
  assert.match(cart.cartSelectionIssue(await cart.fetchGuestCart()), /품절/)
  assert.match(cart.cartSelectionIssue([]), /선택/)
})
test('does not report success if browser storage is unavailable', async () => {
  globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded') }
  await assert.rejects(cart.addGuestCart({ productId: id, optionId: optionA, quantity: 1 }), /저장할 수 없습니다/)
  assert.deepEqual(cart.readGuestCart(), [])
})
