type AboutHeroProps = {
  label: string
  title: string
}

export function AboutHero({ label, title }: AboutHeroProps) {
  return (
    <header className="relative flex min-h-[45vh] items-center justify-center bg-[#E0DDD7] pt-16 text-center md:min-h-[60vh] md:pt-20">
      <div className="reveal-element reveal-active">
        <span className="mono text-dot-primary">{label}</span>
        <h1 className="hero-reveal mt-2 text-4xl font-normal tracking-[0.12em] text-dot-primary lg:text-5xl xl:text-[4.5rem]">
          {title}
        </h1>
      </div>
    </header>
  )
}
