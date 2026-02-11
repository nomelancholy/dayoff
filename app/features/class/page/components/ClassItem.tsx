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
        'reveal-element group grid grid-cols-1 gap-12 py-20 md:grid-cols-2 md:gap-24 md:py-32',
        reverse && '[&>*:first-child]:md:order-2 [&>*:last-child]:md:order-1'
      )}
    >
      <div className="aspect-[4/5] overflow-hidden bg-[#f5f5f5]">
        <img
          src={data.image}
          alt={data.imageAlt}
          className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col justify-center">
        <span className="mono text-[11px] uppercase tracking-[0.25em] text-[#888]">{data.monoLabel}</span>
        <h2 className="mt-4 font-serif text-3xl font-normal tracking-[0.15em] text-dot-primary md:text-[2.5rem] md:leading-tight">
          {data.name}
        </h2>
        <div className="my-8 border-y border-[#eee] py-6">
          {data.infoRows.map((row) => (
            <div key={row.label} className="mb-2 flex gap-8">
              <span className="mono w-20 shrink-0 text-[11px] uppercase tracking-[0.2em] text-[#A8A095]">{row.label}</span>
              <span className="text-[13px] tracking-wide text-dot-primary">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="mb-10 text-[0.95rem] font-light leading-relaxed tracking-wide text-dot-secondary">{data.description}</p>
        <a
          href={data.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono inline-block w-fit bg-[#1A1A1A] px-10 py-4 text-xs font-medium uppercase tracking-[0.25em] text-white! no-underline transition-all hover:bg-[#333] hover:-translate-y-0.5"
        >
          Book Now
        </a>
      </div>
    </div>
  )
}
