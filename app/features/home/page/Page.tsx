import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useReveal } from '@/common/hooks/useReveal'
import { cn } from '@/common/lib/utils'
import { fetchProducts } from '@/features/shop/api/shop'

const HERO_IMAGE = '/assets/main_pic.JPG'
const ABOUT_IMAGE = '/assets/about_pic.jpeg'

/** 메인 하단 미리보기에 노출할 상품 개수 */
const SHOP_PREVIEW_LIMIT = 3

function ScrollIndicator() {
  return (
    <div
      className="absolute bottom-4 left-1/2 z-0 flex -translate-x-1/2 flex-col items-center gap-4 opacity-60 pointer-events-none"
      aria-hidden
    >
      <span className="mono text-dot-primary">SCROLL</span>
      <div className="scroll-indicator-line" />
    </div>
  )
}

export const HomePage = () => {
  const {
    data: shopProducts,
    isLoading: shopPreviewLoading,
    isError: shopPreviewError,
    refetch: refetchShopPreview,
  } = useQuery({
    queryKey: ['shop', 'products', 'home-preview'],
    queryFn: () => fetchProducts(),
    staleTime: 60_000,
  })

  const previewProducts = (shopProducts ?? []).slice(0, SHOP_PREVIEW_LIMIT)
  // 상품 목록/스켈레톤이 교체되는 시점에 맞춰 재관찰합니다.
  const revealRef = useReveal('reveal-element', 'reveal-active', [
    shopPreviewLoading,
    previewProducts.length,
  ])

  return (
    <div ref={revealRef}>
      {/* Hero */}
      <section className="relative flex min-h-screen w-full items-start justify-center overflow-hidden bg-[#E8E6E1] pt-24 md:items-center md:pt-0">
        <div className="relative flex h-full w-full items-center justify-center">
          <img
            src={HERO_IMAGE}
            alt="Masterpiece Ceramic"
            className={cn(
              'hero-img-float h-[52svh] w-[88%] object-cover object-center md:h-[80%] md:w-[60%] max-lg:md:w-[90%]',
              'contrast-[0.9] brightness-105'
            )}
            style={{
              maskImage:
                'linear-gradient(to bottom, black 80%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black 80%, transparent 100%)',
            }}
          />
        </div>
        <div className="hero-text absolute bottom-[16%] left-1/2 z-2 -translate-x-1/2 text-center md:bottom-[10%]">
          <h1 className="hero-reveal mt-4 text-4xl font-light tracking-[0.12em] lg:text-6xl">
            Day Off Today
          </h1>
        </div>
        <ScrollIndicator />
      </section>

      {/* About preview */}
      <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-16 px-6 py-24 md:grid-cols-2 md:gap-24 md:px-8 md:py-32 lg:gap-32 lg:px-16">
        <div className="reveal-element overflow-hidden rounded-sm bg-[#DCD9D4] aspect-4/5">
          <img
            src={ABOUT_IMAGE}
            alt="Pottery Workshop"
            className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-105"
          />
        </div>
        <div className="reveal-element md:pr-8">
          <p className="mt-8 text-[1.3rem] font-medium leading-relaxed text-dot-secondary">
            휴식을 빚는
          </p>
          <p className="mt-8 text-[1.1rem] font-light leading-relaxed text-dot-secondary">
            좋은 도자기는 놓여있는 것만으로도 공간의 온도를 바꿉니다.
          </p>
          <p className="mt-8 text-[1.1rem] font-light leading-relaxed text-dot-secondary">
            <b>DOT(Day Off Today)</b>는 당신이 맞이하는 매일의 휴일이 더욱
            특별해질 수 있도록, 쓰임새와 아름다움의 균형을 고민합니다.
          </p>
          <p className="mt-6 text-[1.1rem] font-light leading-relaxed text-dot-secondary">
            차 한 잔의 여유, 정성스런 식사 시간 속에 <b>DOT</b>의 감각을 더해
            보세요. 정성을 다해 구워낸 작품들이 당신의 일상에 기분 좋은 쉼표가
            되어줄 것입니다.
          </p>
          {/* <Link
            to="/about"
            className="mono mt-8 inline-block text-dot-primary underline underline-offset-2"
          >
            READ MORE
          </Link> */}
        </div>
      </section>

      {/* Shop preview */}
      <section
        id="shop"
        className="bg-dot-surface px-6 py-20 md:px-12 md:py-28 lg:px-16"
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="reveal-element mb-16 flex flex-col justify-between gap-6 border-b border-black/5 pb-8 md:flex-row md:items-end">
            <div></div>
            <Link
              to="/shop"
              className="font-sans text-[0.95rem] font-medium text-dot-primary underline underline-offset-2"
            >
              모든 제품 보기
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
            {shopPreviewLoading ? (
              Array.from({ length: SHOP_PREVIEW_LIMIT }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  className="reveal-element animate-pulse"
                  aria-hidden
                >
                  <div className="mb-6 aspect-square bg-[#E8E6E1]" />
                  <div className="flex justify-between gap-4">
                    <div className="h-4 w-2/5 rounded bg-[#E8E6E1]" />
                    <div className="h-4 w-16 rounded bg-[#E8E6E1]" />
                  </div>
                </div>
              ))
            ) : shopPreviewError ? (
              <div className="reveal-element col-span-full text-center text-[0.95rem] text-dot-secondary">
                <p>미리보기 상품을 불러오지 못했습니다.</p>
                <button
                  type="button"
                  onClick={() => void refetchShopPreview()}
                  className="mono mt-3 text-[0.65rem] uppercase tracking-[0.2em] text-dot-primary underline underline-offset-4"
                >
                  다시 시도
                </button>
              </div>
            ) : previewProducts.length === 0 ? (
              <p className="reveal-element col-span-full text-center text-[0.95rem] text-dot-secondary">
                등록된 상품이 없습니다.{' '}
                <Link
                  to="/shop"
                  className="font-medium text-dot-primary underline underline-offset-2"
                >
                  SHOP
                </Link>
                에서 확인해 보세요.
              </p>
            ) : (
              previewProducts.map((product) => {
                const cover = product.images?.[0]
                return (
                  <Link
                    key={product.id}
                    to={`/shop/${product.slug}`}
                    className="reveal-element group block text-dot-primary no-underline"
                  >
                    <div className="relative mb-6 aspect-square overflow-hidden bg-[#F2F2F2] transition-(--dot-transition)">
                      {cover?.url ? (
                        <img
                          src={cover.url}
                          alt={cover.alt ?? product.name}
                          className="h-full w-full object-cover transition-transform duration-500 ease-dot group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[0.8rem] text-dot-secondary">
                          이미지 없음
                        </div>
                      )}
                      <div
                        className="absolute inset-0 -left-full w-1/2 skew-x-[-25deg] bg-linear-to-r from-transparent via-white/40 to-transparent transition-[left] duration-500 group-hover:left-[150%]"
                        aria-hidden
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-[0.9rem] font-normal tracking-[0.05em]">
                        {product.name}
                      </h3>
                      <span className="shrink-0 text-[0.9rem] text-dot-secondary">
                        ₩{product.price.toLocaleString()}
                      </span>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
