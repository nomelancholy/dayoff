import { useEffect, useRef } from 'react'

const observerOptions: IntersectionObserverInit = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px',
}

export function useReveal(className = 'reveal-element', activeClass = 'reveal-active') {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(activeClass)
        }
      })
    }, observerOptions)

    const nodes = el.querySelectorAll(`.${className}`)
    nodes.forEach((node) => observer.observe(node))
    return () => nodes.forEach((node) => observer.unobserve(node))
  }, [className, activeClass])

  return ref
}
