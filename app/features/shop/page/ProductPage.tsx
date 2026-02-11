import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProduct, addToCart } from '../api/shop'
import { fetchMe, getStoredToken } from '@/features/auth/api/auth'
import { useUiStore } from '@/common/store/ui'
import { cn } from '@/common/lib/utils'
import { Pencil } from 'lucide-react'

export const ShopProductPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState(1)
  const [selectedOptionId, setSelectedCategoryId] = useState<string | undefined>()
  const [mainImageIndex, setMainImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'detail' | 'reviews' | 'shipping'>('detail')
  const token = getStoredToken()

  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })
  const isAdmin = user?.role === 'admin'

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['shop', 'product', id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
  })

  const showToast = useUiStore((s) => s.showToast)

  const cartMutation = useMutation({
    mutationFn: () =>
      addToCart({
        productId: id!,
        quantity,
        optionId: selectedOptionId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'cart'] })
      showToast({
        message: '장바구니에 담겼습니다.',
        actionLabel: '장바구니 보기',
        actionHref: '/cart',
      })
    },
    onError: (err: any) => {
      if (err.response?.status === 401) {
        alert('로그인이 필요합니다.')
        navigate('/login')
      } else {
        alert('장바구니 담기에 실패했습니다.')
      }
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-6 py-32 md:px-16">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div className="aspect-square bg-[#eee]" />
            <div>
              <div className="h-4 w-24 bg-[#eee]" />
              <div className="mt-4 h-10 w-2/3 bg-[#eee]" />
              <div className="mt-8 h-6 w-32 bg-[#eee]" />
              <div className="mt-12 h-20 w-full bg-[#eee]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-6 py-32 md:px-16 text-center">
        <p className="text-[#666]">상품을 찾을 수 없거나 오류가 발생했습니다.</p>
        <Link to="/shop" className="mt-4 inline-block text-dot-primary underline">
          SHOP으로 돌아가기
        </Link>
      </div>
    )
  }

  const handleAddToCart = () => {
    if (!getStoredToken()) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }
    cartMutation.mutate()
  }

  const images = product.images?.length ? product.images : []
  const mainImage = images[mainImageIndex]

  return (
    <div className="min-h-screen bg-dot-bg">
      <div className="mx-auto max-w-[1400px] px-6 py-48 md:px-16 md:pb-40">
        {isAdmin && (
          <div className="mb-6 flex justify-end">
            <Link
              to={`/shop/admin/edit/${product.id}`}
              className="flex items-center gap-2 text-[0.8rem] font-medium uppercase tracking-[0.25em] text-dot-primary transition-colors hover:underline"
            >
              <Pencil size={12} />
              Edit
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1.2fr_1fr]">
          {/* Gallery - reference: product-gallery, main-img aspect 1/1, thumbnail-list 4 cols */}
          <div className="flex flex-col gap-4">
            <div className="aspect-square overflow-hidden rounded-sm bg-[#F2F2F2]">
              {mainImage ? (
                <img
                  src={mainImage.url}
                  alt={mainImage.alt || product.name}
                  className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[0.85rem] uppercase tracking-widest text-[#999]">
                  No Image
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setMainImageIndex(idx)}
                    className={cn(
                      'aspect-square overflow-hidden rounded-sm bg-[#F2F2F2] transition-opacity',
                      mainImageIndex === idx
                        ? 'border border-dot-primary opacity-100'
                        : 'opacity-60 hover:opacity-80'
                    )}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info - reference: breadcrumb mono, product-title 3rem, product-price 1.5rem, product-desc */}
          <div className="flex flex-col">
            <nav className="mono mb-8 text-[0.7rem] tracking-[0.15em] text-dot-secondary">
              <Link to="/shop" className="hover:text-dot-primary">SHOP</Link>
              {' / '}
              {product.category?.name && (
                <>
                  <span>{product.category.name}</span>
                  {' / '}
                </>
              )}
              <span>{product.name}</span>
            </nav>
            <h1 className="font-serif text-3xl font-normal leading-tight tracking-[0.12em] text-dot-primary md:text-4xl">
              {product.name}
            </h1>
            <div className="mt-4 text-[1.5rem] font-light text-dot-primary">
              ₩{product.price.toLocaleString()}
            </div>
            <p className="mt-12 whitespace-pre-line text-[0.95rem] font-light leading-relaxed text-dot-secondary">
              {product.description || 'No description available.'}
            </p>

            {/* Purchase Options - reference: border-top, option-row, qty, action-btns */}
            <div className="mt-12 border-t border-[#eee] pt-12">
              {product.options && product.options.length > 0 && (
                <div className="mb-8">
                  <label className="mono mb-3 block text-[0.7rem] tracking-[0.15em] text-dot-primary">
                    OPTIONS
                  </label>
                  <select
                    value={selectedOptionId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full border border-[#eee] bg-white px-4 py-4 text-[0.95rem] focus:border-dot-primary focus:outline-none"
                  >
                    <option value="">Select an option</option>
                    {product.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}: {opt.value}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-8">
                <label className="mono mb-3 block text-[0.7rem] tracking-[0.15em] text-dot-primary">
                  QUANTITY
                </label>
                <div className="flex w-fit items-center gap-6 border border-[#eee] bg-white px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex items-center justify-center text-dot-primary hover:opacity-70"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-[0.95rem]">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="flex items-center justify-center text-dot-primary hover:opacity-70"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={cartMutation.isPending}
                  className="mono border border-dot-primary bg-white py-4 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white disabled:opacity-50"
                >
                  {cartMutation.isPending ? 'Adding…' : 'Add to Cart'}
                </button>
                <button
                  type="button"
                  onClick={() => alert('결제 기능은 준비 중입니다.')}
                  className="mono bg-dot-primary py-4 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#333]"
                >
                  Buy It Now
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - reference: product-tabs-container, tabs-header sticky, tab-content */}
        <section className="mt-32 border-t border-[#eee]">
          <div className="mono sticky top-20 z-[800] flex justify-center gap-12 border-b border-[#eee] bg-dot-bg md:gap-16">
            {[
              { id: 'detail' as const, label: 'DETAIL' },
              { id: 'reviews' as const, label: `REVIEWS ${product.reviews?.length ? `(${product.reviews.length})` : ''}` },
              { id: 'shipping' as const, label: 'SHIPPING & RETURNS' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative border-none bg-transparent py-6 px-4 text-[0.85rem] transition-colors',
                  activeTab === tab.id
                    ? 'font-medium text-dot-primary'
                    : 'text-dot-secondary hover:text-dot-primary'
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-dot-primary" />
                )}
              </button>
            ))}
          </div>

          {activeTab === 'detail' && (
            <div className="mx-auto max-w-[1000px] py-16">
              {product.detailImages && product.detailImages.length > 0 && (
                <div className="flex flex-col gap-0">
                  {product.detailImages.map((img) => (
                    <img
                      key={img.id}
                      src={img.url}
                      alt={img.alt || product.name}
                      className="w-full object-contain"
                    />
                  ))}
                </div>
              )}
              {product.purchaseNotice && (
                <div className="mt-12">
                  <h3 className="mono mb-4 text-[0.85rem] text-dot-primary">구매 전 안내사항</h3>
                  <p className="whitespace-pre-line text-[0.9rem] leading-relaxed text-dot-secondary">
                    {product.purchaseNotice}
                  </p>
                </div>
              )}
              {product.handlingNotice && (
                <div className="mt-8">
                  <h3 className="mono mb-4 text-[0.85rem] text-dot-primary">취급 및 구매 주의사항</h3>
                  <p className="whitespace-pre-line text-[0.9rem] leading-relaxed text-dot-secondary">
                    {product.handlingNotice}
                  </p>
                </div>
              )}
              {!product.detailImages?.length && !product.purchaseNotice && !product.handlingNotice && (
                <p className="text-[0.9rem] text-dot-secondary">No additional details.</p>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="mx-auto max-w-[1000px] py-16">
              <h3 className="mono text-center text-dot-primary">CUSTOMER REVIEWS</h3>
              {product.reviews && product.reviews.length > 0 ? (
                <ul className="mt-16 flex flex-col gap-8 text-left">
                  {product.reviews.map((review) => (
                    <li key={review.id} className="border-b border-[#eee] pb-8 last:border-0">
                      {review.rating != null && (
                        <div className="mb-2 flex gap-0.5 text-amber-500" aria-label={`별점 ${review.rating}점`}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span key={i} className="text-base leading-none">
                              {i <= review.rating! ? '★' : '☆'}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[1rem] leading-relaxed text-dot-primary">
                        {review.body}
                      </p>
                      {review.images && review.images.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          {review.images.map((img) => (
                            <a
                              key={img.id}
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-28 w-28 overflow-hidden rounded border border-[#eee] bg-[#f9f9f9]"
                            >
                              <img src={img.url} alt="" className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      <span className="mono mt-4 block text-[0.7rem] text-dot-secondary">
                        {review.user?.fullName || review.user?.email || '회원'} |{' '}
                        {new Date(review.createdAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-16 text-center text-[0.95rem] text-dot-secondary">
                  아직 구매평이 없습니다.
                </p>
              )}
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="mx-auto max-w-[1000px] py-16">
              <h3 className="mono mb-16 text-center text-dot-primary">SHIPPING & RETURNS</h3>
              <table className="w-full border-collapse text-[0.9rem]">
                <tbody>
                  <tr className="border-b border-[#eee]">
                    <th className="w-[200px] bg-[#F9F9F9] p-5 text-left font-medium text-dot-primary">
                      배송 정보
                    </th>
                    <td className="p-5 text-dot-secondary">
                      기본 배송비: 3,000원 (50,000원 이상 구매 시 무료)
                      <br />
                      배송 기간: 주문 확인 후 3~7일 이내 발송
                    </td>
                  </tr>
                  <tr className="border-b border-[#eee]">
                    <th className="w-[200px] bg-[#F9F9F9] p-5 text-left font-medium text-dot-primary">
                      교환/반품 안내
                    </th>
                    <td className="p-5 text-dot-secondary">
                      도자기 특성상 단순 변심에 의한 교환/반품은 어려울 수 있습니다.
                      <br />
                      제품 파손 시 수령 후 24시간 이내에 사진과 함께 고객센터로 연락 부탁드립니다.
                    </td>
                  </tr>
                  <tr className="border-b border-[#eee]">
                    <th className="w-[200px] bg-[#F9F9F9] p-5 text-left font-medium text-dot-primary">
                      주의 사항
                    </th>
                    <td className="p-5 text-dot-secondary">
                      수작업 특성상 크기, 형태, 유약의 흐름 등이 사진과 다를 수 있습니다.
                      <br />
                      미세한 점이나 기포는 가마 소성 과정에서 발생하는 자연스러운 현상입니다.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
