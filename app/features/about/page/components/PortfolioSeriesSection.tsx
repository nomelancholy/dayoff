import { cn } from '@/common/lib/utils'

export type PortfolioSeries = {
  number: string
  subtitle: string
  title: string
  description: readonly string[]
  material: string
  cover: {
    src: string
    alt: string
  }
  gallery: readonly {
    src: string
    alt: string
  }[]
}

type PortfolioSeriesSectionProps = {
  series: PortfolioSeries
  index: number
}

export function PortfolioSeriesSection({
  series,
  index,
}: PortfolioSeriesSectionProps) {
  const imageFirst = index % 2 === 1

  return (
    <section
      id={`series-${series.number}`}
      className={cn(
        'scroll-mt-24 border-t border-black/10 px-6 py-20 md:px-12 md:py-28 lg:px-16 lg:py-36',
        index % 2 === 1 ? 'bg-[#EEECE7]' : 'bg-dot-bg'
      )}
    >
      <div className="mx-auto max-w-[1500px]">
        <header className="reveal-element flex flex-col gap-2 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-light tracking-[-0.03em] text-[#A69A8B] md:text-5xl">
              Series {series.number}
            </span>
            <span className="text-sm font-light text-dot-secondary md:text-base">
              {series.subtitle}
            </span>
          </div>
          <span className="mono text-[0.62rem] text-dot-secondary">
            Selected Works — 2026
          </span>
        </header>

        <div className="mt-10 grid items-center gap-12 lg:grid-cols-12 lg:gap-16 xl:gap-24">
          <div
            className={cn(
              'reveal-element lg:col-span-5',
              imageFirst && 'lg:order-2'
            )}
          >
            <p className="mono text-[0.65rem] text-[#A69A8B]">
              Ceramic collection
            </p>
            <h2
              className={cn(
                'mt-5 font-normal leading-[1.15] tracking-[-0.035em] text-dot-primary',
                series.number === '05'
                  ? 'text-[1.75rem] sm:text-3xl lg:whitespace-nowrap lg:text-[clamp(1.8rem,2.3vw,2.25rem)]'
                  : 'text-3xl sm:text-4xl xl:text-5xl'
              )}
            >
              {series.title}
            </h2>
            <div className="mt-8 space-y-5">
              {series.description.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-base font-light leading-[1.9] text-dot-secondary md:text-[1.05rem]"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="mt-10 border-t border-black/10 pt-5 text-sm font-light text-[#8F8375]">
              {series.material}
            </p>
          </div>

          <figure
            className={cn(
              'reveal-element lg:col-span-7',
              imageFirst && 'lg:order-1'
            )}
          >
            <div className="aspect-4/3 overflow-hidden bg-[#E5EDF3]">
              <img
                src={series.cover.src}
                alt={series.cover.alt}
                loading="lazy"
                decoding="async"
                className={cn(
                  'h-full w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-[1.02]',
                  index === 0 && 'object-[center_68%]'
                )}
              />
            </div>
          </figure>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {series.gallery.map((image) => (
            <figure
              key={image.src}
              className="reveal-element aspect-3/2 overflow-hidden bg-[#E5EDF3]"
            >
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-[1.025]"
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
