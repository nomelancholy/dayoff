import { Link } from 'react-router-dom'
import { useReveal } from '@/common/hooks/useReveal'
import { cn } from '@/common/lib/utils'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=2000'
const ABOUT_IMAGE =
  'https://images.unsplash.com/photo-1565191999001-551c187427bb?auto=format&fit=crop&q=80&w=1000'

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
      className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4 opacity-60"
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
              maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
            }}
          />
        </div>
        <div className="hero-text absolute bottom-[10%] left-1/2 z-2 -translate-x-1/2 text-center">
          <span className="mono text-dot-primary">CRAFTED SILENCE</span>
          <h1 className="hero-reveal mt-4 text-4xl font-light tracking-[0.12em] lg:text-6xl">
            The Art of Stillness
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
          <span className="mono text-dot-primary">OUR PHILOSOPHY</span>
          <h2 className="mt-4 text-2xl font-normal leading-tight tracking-[0.12em] text-dot-primary md:text-3xl">
            점(DOT) 하나에서 시작되는
            <br />
            흙의 숨결과 기물의 서사
          </h2>
          <p className="mt-8 text-[1.1rem] font-light leading-relaxed text-dot-secondary">
            공방 DOT.는 정적 속에 흐르는 아름다움을 탐구합니다. 손끝에 닿는 흙의 질감, 가마 속에서
            일어나는 우연한 변화, 그리고 마침내 완성된 기물이 당신의 일상에 머물 때 일어나는 조용한
            변화를 믿습니다.
          </p>
          <p className="mt-6 text-[1.1rem] font-light leading-relaxed text-dot-secondary">
            우리는 단순히 그릇을 만드는 것이 아닌, 삶의 여백을 채우는 정서를 빚어냅니다.
          </p>
          <Link
            to="/about"
            className="mono mt-8 inline-block text-dot-primary underline underline-offset-2"
          >
            READ MORE
          </Link>
        </div>
      </section>

      {/* Shop preview */}
      <section id="shop" className="bg-dot-surface px-6 py-20 md:px-12 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1400px]">
          <div className="reveal-element mb-16 flex flex-col justify-between gap-6 border-b border-black/5 pb-8 md:flex-row md:items-end">
            <div>
              <span className="mono text-dot-primary">COLLECTIONS</span>
              <h2 className="mt-2 text-2xl font-normal tracking-[0.12em] text-dot-primary md:text-3xl">
                SHOP THE EDITION
              </h2>
            </div>
            <Link to="/shop" className="mono text-dot-primary underline underline-offset-2">
              VIEW ALL PRODUCTS
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
                  <h3 className="text-[0.9rem] font-normal tracking-[0.05em]">{product.name}</h3>
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
