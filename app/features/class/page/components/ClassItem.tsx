import type { ClassItemData } from '../classData'
import { cn } from '@/common/lib/utils'

type ClassItemProps = {
  data: ClassItemData
  /** 짝수 번째 아이템은 이미지 오른쪽 배치 */
  reverse?: boolean
}

export function ClassItem({ data, reverse = false }: ClassItemProps) {
  return (
    <div
      className={cn(
        'reveal-element group grid grid-cols-1 gap-12 py-16 md:grid-cols-2 md:gap-24 md:py-20',
        reverse && '[&>*:first-child]:md:order-2 [&>*:last-child]:md:order-1'
      )}
    >
      <div className="aspect-[4/5] overflow-hidden rounded-sm">
        <img
          src={data.image}
          alt={data.imageAlt}
          className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col justify-center">
        <span className="mono text-dot-primary">{data.monoLabel}</span>
        <h2 className="mt-4 font-serif text-2xl font-normal tracking-[0.12em] text-dot-primary md:text-3xl">
          {data.name}
        </h2>
        <div className="my-8 border-y border-black/10 py-6">
          {data.infoRows.map((row) => (
            <div key={row.label} className="mb-2 flex gap-8">
              <span className="mono w-20 shrink-0 text-dot-accent">{row.label}</span>
              <span className="text-dot-primary">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="mb-10 font-light leading-relaxed text-dot-secondary">{data.description}</p>
        <a
          href={data.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono inline-block w-fit bg-dot-primary px-10 py-4 text-dot-bg no-underline transition-(--dot-transition) hover:opacity-90 hover:-translate-y-0.5"
        >
          BOOK NOW
        </a>
      </div>
    </div>
  )
}
