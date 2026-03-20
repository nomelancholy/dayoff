import { Link } from 'react-router-dom'
import { useReveal } from '@/common/hooks/useReveal'
import { cn } from '@/common/lib/utils'

const HERO_IMAGE = '/assets/main_pic.JPG'
const ABOUT_IMAGE = '/assets/about_pic.jpeg'

const SHOP_PREVIEW_PRODUCTS = [
  {
    id: '1',
    name: 'MOONLIGHT VASE',
    price: 82000,
    image:
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=800',
    alt: 'Ceramic Vase',
  },
  {
    id: '2',
    name: 'EARTHEN TEA SET',
    price: 124000,
    image:
      'https://images.unsplash.com/photo-1578507065211-1c4e99a5fd24?auto=format&fit=crop&q=80&w=800',
    alt: 'Tea Set',
  },
  {
    id: '3',
    name: 'PALE MIST PLATE',
    price: 45000,
    image:
      'https://images.unsplash.com/photo-1449444004900-5895743c3917?auto=format&fit=crop&q=80&w=800',
    alt: 'Hand-built Plate',
  },
] as const

function ScrollIndicator() {
  return (
    <div
      className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4 opacity-60"
      aria-hidden
    >
      <span className="mono text-dot-primary">SCROLL</span>
      <div className="scroll-indicator-line" />
    </div>
  )
}

export const HomePage = () => {
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      {/* Hero */}
      <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#E8E6E1]">
        <div className="relative flex h-full w-full items-center justify-center">
          <img
            src={HERO_IMAGE}
            alt="Masterpiece Ceramic"
            className={cn(
              'hero-img-float h-[80%] w-[60%] max-lg:w-[90%] object-cover object-center',
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
        <div className="hero-text absolute bottom-[10%] left-1/2 z-2 -translate-x-1/2 text-center">
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
            {SHOP_PREVIEW_PRODUCTS.map((product) => (
              <Link
                key={product.id}
                to={`/shop/${product.id}`}
                className="reveal-element group block text-dot-primary no-underline"
              >
                <div className="relative mb-6 aspect-square overflow-hidden bg-[#F2F2F2] transition-(--dot-transition)">
                  <img
                    src={product.image}
                    alt={product.alt}
                    className="h-full w-full object-cover transition-transform duration-500 ease-dot group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0 -left-full w-1/2 skew-x-[-25deg] bg-linear-to-r from-transparent via-white/40 to-transparent transition-[left] duration-500 group-hover:left-[150%]"
                    aria-hidden
                  />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.9rem] font-normal tracking-[0.05em]">
                    {product.name}
                  </h3>
                  <span className="text-[0.9rem] text-dot-secondary">
                    ₩{product.price.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
