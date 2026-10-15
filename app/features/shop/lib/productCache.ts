import type { QueryClient } from '@tanstack/react-query'
import type { Product } from '../api/shop'

const productQueries = [
  ['shop', 'admin', 'products'],
  ['shop', 'products'],
  ['shop', 'product'],
  ['shop', 'cart'],
] as const

/** Apply the confirmed save before navigating, including inactive admin caches. */
export async function syncSavedProduct(
  queryClient: QueryClient,
  saved: Product
) {
  // An older in-flight read must not overwrite the confirmed save.
  await Promise.all(
    productQueries.map((queryKey) => queryClient.cancelQueries({ queryKey }))
  )

  // Admin responses may contain unmasked review authors. Keep public reviews
  // from their own endpoint instead of copying them into shared detail caches.
  const fields = { ...saved, reviews: undefined }
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ['shop'] })) {
    const key = query.queryKey
    const isAdminList = key[1] === 'admin' && key[2] === 'products'
    if (isAdminList || key[1] === 'products') {
      queryClient.setQueryData<Product[]>(key, (previous) =>
        previous?.flatMap((item) => {
          if (item.id !== saved.id) return [item]
          const categoryId = isAdminList ? undefined : key[2]
          if (
            !saved.isActive ||
            (categoryId && categoryId !== saved.categoryId)
          ) {
            return []
          }
          return [{ ...item, ...fields, reviews: item.reviews }]
        })
      )
    }
    if (key[1] === 'product') {
      queryClient.setQueryData<Product>(key, (previous) =>
        previous?.id === saved.id
          ? { ...previous, ...fields, reviews: previous.reviews }
          : previous
      )
    }
  }

  // Detail pages use either ID or slug; seed both for immediate navigation.
  for (const identifier of new Set([saved.id, saved.slug])) {
    queryClient.setQueryData<Product>(
      ['shop', 'product', identifier],
      (previous) => ({
        ...previous,
        ...fields,
        reviews: previous?.reviews,
      })
    )
  }

  // Refetch active readers and mark inactive lists stale (also covers creation,
  // category moves, and cart snapshots without guessing their membership).
  await Promise.all(
    productQueries.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  )
}
