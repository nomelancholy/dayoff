import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import { syncSavedProduct } from '../app/features/shop/lib/productCache.ts'

const product = {
  id: 'p1',
  slug: 'cup',
  categoryId: 'cups',
  name: 'Cup',
  stockQuantity: 0,
  isActive: true,
  price: 1000,
}
const adminKey = ['shop', 'admin', 'products']
const listKey = ['shop', 'products', 'cups']
const detailKey = ['shop', 'product', 'cup']
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: false } },
  })

test('0 → 1 is visible in the inactive admin list and both detail keys without a reload', async () => {
  const cache = client()
  try {
    cache.setQueryData(adminKey, [product])
    cache.setQueryData(listKey, [product])
    cache.setQueryData(detailKey, product)
    cache.setQueryData(['shop', 'product', product.id], product)
    cache.setQueryData(['shop', 'cart'], [])
    await syncSavedProduct(cache, { ...product, stockQuantity: 1 })
    assert.equal(cache.getQueryData(adminKey)[0].stockQuantity, 1)
    assert.equal(cache.getQueryData(listKey)[0].stockQuantity, 1)
    assert.equal(cache.getQueryData(detailKey).stockQuantity, 1)
    assert.equal(
      cache.getQueryData(['shop', 'product', product.id]).stockQuantity,
      1
    )
    for (const key of [adminKey, listKey, detailKey, ['shop', 'cart']]) {
      assert.equal(cache.getQueryState(key).isInvalidated, true)
    }
  } finally {
    cache.clear()
  }
})

test('a slow pre-save response cannot restore stale stock', async () => {
  const cache = client()
  try {
    cache.setQueryData(adminKey, [product])
    let resolveRead
    const oldRead = cache
      .fetchQuery({
        queryKey: adminKey,
        staleTime: 0,
        queryFn: () =>
          new Promise((resolve) => {
            resolveRead = resolve
          }),
      })
      .catch(() => {})
    await syncSavedProduct(cache, { ...product, stockQuantity: 1 })
    resolveRead([product])
    await oldRead
    assert.equal(cache.getQueryData(adminKey)[0].stockQuantity, 1)
  } finally {
    cache.clear()
  }
})

test('creation invalidates cached lists and seeds the new detail', async () => {
  const cache = client()
  try {
    cache.setQueryData(adminKey, [])
    cache.setQueryData(listKey, [])
    await syncSavedProduct(cache, product)
    assert.equal(cache.getQueryState(adminKey).isInvalidated, true)
    assert.equal(cache.getQueryState(listKey).isInvalidated, true)
    assert.equal(cache.getQueryData(detailKey).id, product.id)
  } finally {
    cache.clear()
  }
})

test('category/slug changes preserve public reviews and invalidate old addresses', async () => {
  const cache = client()
  try {
    const reviews = [{ user: { email: 'm***@example.com' } }]
    cache.setQueryData(adminKey, [product])
    cache.setQueryData(listKey, [product])
    cache.setQueryData(detailKey, { ...product, reviews })
    await syncSavedProduct(cache, {
      ...product,
      slug: 'new-cup',
      categoryId: 'plates',
      reviews: [{ user: { email: 'member@example.com' } }],
    })
    assert.deepEqual(cache.getQueryData(listKey), [])
    assert.equal(cache.getQueryData(adminKey)[0].categoryId, 'plates')
    assert.deepEqual(cache.getQueryData(detailKey).reviews, reviews)
    assert.equal(cache.getQueryState(detailKey).isInvalidated, true)
    assert.equal(
      cache.getQueryData(['shop', 'product', 'new-cup']).reviews,
      undefined
    )
  } finally {
    cache.clear()
  }
})
