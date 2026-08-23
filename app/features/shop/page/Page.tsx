import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchCategories, fetchProducts } from '../api/shop'
import { fetchMe, getStoredToken } from '@/features/auth/api/auth'
import { cn } from '@/common/lib/utils'
import { Plus } from 'lucide-react'
import { ProductPrice } from '../components/ProductPrice'

export const ShopPage = () => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >()
  const token = getStoredToken()

  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })

  const isAdmin = user?.role === 'admin'

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['shop', 'categories'],
    queryFn: fetchCategories,
  })

  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['shop', 'products', selectedCategoryId],
    queryFn: () => fetchProducts(selectedCategoryId),
  })

  const isLoading = categoriesLoading || productsLoading
  const productList = products ?? []

  return (
    <div className="min-h-screen bg-dot-bg">
      {/* Admin: Add product (Hero와 카테고리 탭 사이, 우측 정렬) */}
      {isAdmin && (
        <div className="flex justify-end bg-dot-bg px-6 py-4 md:px-16">
          <Link
            to="/shop/admin/new"
            className="mono flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-dot-primary no-underline transition-colors hover:underline"
          >
            <Plus size={12} />
            Add product
          </Link>
        </div>
      )}

      {/* Filter Section - reference: sticky, padding 4rem 4rem 2rem, gap 2rem */}
      <div className="sticky top-20 z-900 border-b border-transparent bg-dot-bg px-4 py-6 md:px-16 md:py-10">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex w-max min-w-full items-center justify-center gap-3 whitespace-nowrap md:w-full md:gap-8">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(undefined)}
              className={cn(
                'mono relative shrink-0 appearance-none border-0 bg-transparent px-3 py-2 text-sm text-dot-secondary transition-colors outline-none! ring-0! focus:outline-none! focus-visible:outline-none! focus:ring-0! focus-visible:ring-0! md:px-4 md:text-base',
                !selectedCategoryId
                  ? 'text-dot-primary'
                  : 'hover:text-dot-primary'
              )}
            >
              All
              {!selectedCategoryId && (
                <span className="absolute bottom-0 left-1/2 h-px w-full -translate-x-1/2 bg-dot-primary" />
              )}
            </button>
            {categories?.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className={cn(
                  'mono relative shrink-0 appearance-none border-0 bg-transparent px-3 py-2 text-sm text-dot-secondary transition-colors outline-none! ring-0! focus:outline-none! focus-visible:outline-none! focus:ring-0! focus-visible:ring-0! md:px-4 md:text-base',
                  selectedCategoryId === category.id
                    ? 'text-dot-primary'
                    : 'hover:text-dot-primary'
                )}
              >
                {category.name}
                {selectedCategoryId === category.id && (
                  <span className="absolute bottom-0 left-1/2 h-px w-full -translate-x-1/2 bg-dot-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shop Grid - reference: section-shop-main, grid 3 cols, gap 4rem 2rem */}
      <main className="mx-auto max-w-[1400px] px-6 pb-40 pt-16 md:px-16 md:pb-48">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-x-8 md:gap-y-16 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-[#F2F2F2]" />
                <div className="mt-6 h-3 w-2/3 bg-[#f0f0f0]" />
                <div className="mt-3 h-3 w-1/3 bg-[#f0f0f0]" />
              </div>
            ))}
          </div>
        ) : productsError ? (
          <div className="py-20 text-center text-dot-secondary">
            <p className="text-sm">상품 목록을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => void refetchProducts()}
              className="mono mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-dot-primary underline underline-offset-4"
            >
              다시 시도
            </button>
          </div>
        ) : productList.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-x-8 md:gap-y-16 lg:grid-cols-3">
            {productList.map((product) => {
              const isSoldOut = product.stockQuantity <= 0
              return (
                <Link
                  key={product.id}
                  to={`/shop/${product.slug}`}
                  className={cn(
                    'group block text-inherit no-underline transition-opacity duration-400',
                    isSoldOut
                      ? 'opacity-70 hover:opacity-80'
                      : 'hover:opacity-90'
                  )}
                >
                  <div className="relative mb-6 aspect-square overflow-hidden bg-[#F2F2F2]">
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].alt || product.name}
                        loading="lazy"
                        decoding="async"
                        className={cn(
                          'h-full w-full object-cover transition-transform duration-[0.6s] ease-dot',
                          isSoldOut
                            ? 'grayscale-[0.6] contrast-[0.9]'
                            : 'group-hover:scale-105'
                        )}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-widest text-[#ccc]">
                        No Image
                      </div>
                    )}
                    {isSoldOut && (
                      <div className="absolute left-3 top-3 rounded-sm bg-black/80 px-2.5 py-1 text-[0.62rem] font-medium tracking-[0.12em] text-white">
                        SOLD OUT
                      </div>
                    )}
                  </div>
                  {product.category && (
                    <span className="mono mb-2 block text-[0.6rem] text-dot-accent">
                      {product.category.name}
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans text-[0.95rem] font-medium tracking-[0.01em] text-dot-primary">
                      {product.name}
                    </h3>
                    <ProductPrice
                      product={product}
                      className="shrink-0 justify-end text-[0.9rem] font-light text-dot-secondary"
                      originalClassName="text-[0.78rem]"
                      rateClassName="text-[0.78rem]"
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-dot-secondary">
            <p className="text-sm">해당 카테고리에 등록된 상품이 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  )
}
