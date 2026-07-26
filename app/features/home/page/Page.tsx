import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useReveal } from '@/common/hooks/useReveal'
import { cn } from '@/common/lib/utils'
import { fetchProducts } from '@/features/shop/api/shop'

const HERO_IMAGE = '/assets/main_pic_01.jpg'
const HERO_IMAGE_SECONDARY = '/assets/main_pic_02.JPG'
const HERO_IMAGE_TERTIARY = '/assets/main_pic_03.jpg'
const ABOUT_IMAGE = '/assets/about_pic.jpg'

/** 메인 하단 미리보기에 노출할 상품 개수 */
const SHOP_PREVIEW_LIMIT = 3

function ScrollIndicator() {
  return (
    <div
      className="flex flex-col items-center gap-4 opacity-60 pointer-events-none"
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
      {/* Hero: 하단 타이틀+SCROLL은 플로우로 묶어 뷰포트 높이가 낮아도 겹치지 않게 함 */}
      <section className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#E8E6E1]">
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center pt-24 pb-4 md:pt-8 md:pb-6">
          <div
            className={cn(
              'hero-image-grid hero-img-float grid h-[52svh] max-h-[45dvh] w-[88%] overflow-hidden',
              'md:h-[80%] md:max-h-[65dvh] md:w-full',
              'contrast-[0.9] brightness-105'
            )}
            style={{
              maskImage:
                'linear-gradient(to bottom, black 80%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black 80%, transparent 100%)',
            }}
          >
            <img
              src={HERO_IMAGE}
              alt="Masterpiece Ceramic"
              className="hero-image-primary h-full min-h-0 w-full min-w-0 object-cover object-center"
            />
            <img
              src={HERO_IMAGE_SECONDARY}
              alt=""
              className="hero-image-secondary hidden h-full min-h-0 w-full min-w-0 object-cover object-center lg:block"
            />
            <img
              src={HERO_IMAGE_TERTIARY}
              alt=""
              className="hidden h-full min-h-0 w-full min-w-0 object-cover object-center min-[1800px]:block"
            />
          </div>
        </div>
        <div className="hero-text relative z-2 flex shrink-0 flex-col items-center gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-center md:gap-6 md:pb-10 md:pt-4">
          <h1 className="hero-reveal text-4xl font-light tracking-[0.12em] lg:text-6xl">
            Day Off Today
          </h1>
          <ScrollIndicator />
        </div>
      </section>

      {/* About preview */}
      <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-16 px-6 py-24 md:grid-cols-2 md:gap-24 md:px-8 md:py-32 lg:gap-32 lg:px-16">
        <div className="reveal-element aspect-3/2 overflow-hidden rounded-sm bg-[#DCD9D4]">
          <img
            src={ABOUT_IMAGE}
            alt="Pottery Workshop"
            className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-105"
          />
        </div>
        <div className="reveal-element md:pr-8">
          <p className="mt-8 text-[1.3rem] font-medium leading-relaxed text-dot-secondary">
            유약이 빚어낸 온전한 휴식(休)
          </p>
          <p className="mt-8 text-[1.1rem] font-light leading-relaxed text-dot-secondary">
            도자기 브랜드 ‘Day Off Today’는 일상 속 온전한 쉼을 전합니다.
            브랜드 이름인 ‘휴일’의 의미를 상형문자 ‘휴(休)’로 시각화하여,
            언제든 기대어 쉴 수 있는 나무 같은 기물을 빚습니다.
          </p>
          <p className="mt-8 text-[1.1rem] font-light leading-relaxed text-dot-secondary">
            자연을 닮은 화려하지 않은 색채들을 연구해 오래 곁에 둘수록 평온함을
            주는 독창적인 발색을 찾아냅니다. 디오티를 만나는 분들에게 도자기를
            빚는 과정에서 필요한 흙과 불, 유약의 조화로 빚어낸 따듯한 위로를
            식탁 위에 올려드립니다.
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
                const isSoldOut = product.stockQuantity <= 0
                return (
                  <Link
                    key={product.id}
                    to={`/shop/${product.slug}`}
                    className={cn(
                      'reveal-element group block text-dot-primary no-underline transition-opacity duration-400',
                      isSoldOut
                        ? 'opacity-70 hover:opacity-80'
                        : 'hover:opacity-90'
                    )}
                  >
                    <div className="relative mb-6 aspect-square overflow-hidden bg-[#F2F2F2] transition-(--dot-transition)">
                      {cover?.url ? (
                        <img
                          src={cover.url}
                          alt={cover.alt ?? product.name}
                          className={cn(
                            'h-full w-full object-cover transition-transform duration-500 ease-dot',
                            isSoldOut
                              ? 'grayscale-[0.6] contrast-[0.9]'
                              : 'group-hover:scale-105'
                          )}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[0.8rem] text-dot-secondary">
                          이미지 없음
                        </div>
                      )}
                      {isSoldOut && (
                        <div className="absolute left-3 top-3 rounded-sm bg-black/80 px-2.5 py-1 text-[0.62rem] font-medium tracking-[0.12em] text-white">
                          SOLD OUT
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
