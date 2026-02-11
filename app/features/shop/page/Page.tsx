import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchCategories, fetchProducts } from '../api/shop'
import { fetchMe, getStoredToken } from '@/features/auth/api/auth'
import { cn } from '@/common/lib/utils'
import { Plus } from 'lucide-react'

export const ShopPage = () => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>()
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

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['shop', 'products', selectedCategoryId],
    queryFn: () => fetchProducts(selectedCategoryId),
  })

  const isLoading = categoriesLoading || productsLoading

  return (
    <div className="min-h-screen bg-dot-bg">
      {/* Shop Hero - reference: .shop-hero #EBE9E4, 12rem 4rem 6rem */}
      <header className="relative bg-[#EBE9E4] px-6 pb-24 pt-48 text-center md:px-16 md:pb-32 md:pt-52">
        {isAdmin && (
          <div className="absolute right-6 top-12 md:right-16 md:top-16">
            <Link
              to="/shop/admin/new"
              className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-dot-primary transition-colors hover:underline"
            >
              <Plus size={12} />
              Add product
            </Link>
          </div>
        )}
        <span className="mono text-dot-primary">COLLECTIONS</span>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-[0.12em] text-dot-primary md:text-5xl lg:text-[3.5rem]">
          Shop the Edition
        </h1>
        <p className="mono mt-4 text-dot-primary/60">
          Essential pieces for your daily ritual
        </p>
      </header>

      {/* Filter Section - reference: sticky, padding 4rem 4rem 2rem, gap 2rem */}
      <div className="sticky top-20 z-[900] flex justify-center gap-8 border-b border-transparent bg-dot-bg px-6 py-8 md:px-16 md:py-10">
        <button
          type="button"
          onClick={() => setSelectedCategoryId(undefined)}
          className={cn(
            'mono relative border-none bg-transparent px-4 py-2 text-dot-secondary transition-colors',
            !selectedCategoryId ? 'text-dot-primary' : 'hover:text-dot-primary'
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
              'mono relative border-none bg-transparent px-4 py-2 text-dot-secondary transition-colors',
              selectedCategoryId === category.id ? 'text-dot-primary' : 'hover:text-dot-primary'
            )}
          >
            {category.name}
            {selectedCategoryId === category.id && (
              <span className="absolute bottom-0 left-1/2 h-px w-full -translate-x-1/2 bg-dot-primary" />
            )}
          </button>
        ))}
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
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-x-8 md:gap-y-16 lg:grid-cols-3">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/shop/${product.id}`}
                className="group block text-inherit no-underline transition-opacity duration-400 hover:opacity-90"
              >
                <div className="relative mb-6 aspect-square overflow-hidden bg-[#F2F2F2]">
                  {product.images && product.images[0] ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt || product.name}
                      className="h-full w-full object-cover transition-transform duration-[0.6s] ease-dot group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-widest text-[#ccc]">
                      No Image
                    </div>
                  )}
                </div>
                {product.category && (
                  <span className="mono mb-2 block text-[0.6rem] text-dot-accent">
                    {product.category.name}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-[0.95rem] font-normal tracking-[0.05em] text-dot-primary">
                    {product.name}
                  </h3>
                  <span className="text-[0.9rem] font-light text-dot-secondary">
                    ₩{product.price.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-dot-secondary">
            <p className="mono text-sm">No products found in this category.</p>
          </div>
        )}
      </main>
    </div>
  )
}
