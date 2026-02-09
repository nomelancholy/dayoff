import { useState } from 'react'
import { WAYFINDING_ROUTES } from '../contactData'
import { cn } from '@/common/lib/utils'

export function WayfindingSection() {
  const [activeId, setActiveId] = useState(WAYFINDING_ROUTES[0].id)
  const activeRoute = WAYFINDING_ROUTES.find((r) => r.id === activeId) ?? WAYFINDING_ROUTES[0]

  return (
    <section className="bg-dot-surface px-6 py-24 md:px-12 md:py-32 lg:px-16">
      <div className="reveal-element mb-24 text-center">
        <span className="mono text-dot-primary">HOW TO FIND US</span>
        <h2 className="mt-2 font-serif text-3xl font-normal tracking-[0.12em] text-dot-primary">
          골목 사이로 찾아오는 특별한 여정
        </h2>
      </div>

      <div className="mono mx-auto max-w-4xl">
        <div className="flex flex-wrap justify-center gap-6 border-b border-black/10 pb-0 md:gap-12">
          {WAYFINDING_ROUTES.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => setActiveId(route.id)}
              className={cn(
                'relative -mb-px border-b-2 pb-5 pt-0 text-[0.9rem] transition-[color,border-color] duration-300',
                activeId === route.id
                  ? 'border-dot-primary font-medium text-dot-primary'
                  : 'border-transparent text-dot-secondary hover:text-dot-primary'
              )}
            >
              {route.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-[1200px]">
        <div
          key={activeId}
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {activeRoute.steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-6">
              <span className="mono text-[0.7rem] text-dot-accent">{step.stepNumber}</span>
              <div className="aspect-[4/3] overflow-hidden rounded-sm bg-[#F9F9F9]">
                <img
                  src={step.image}
                  alt={step.imageAlt}
                  className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-105"
                />
              </div>
              <p className="text-[0.95rem] font-light leading-relaxed text-dot-secondary">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
