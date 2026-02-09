type ClassHeroProps = {
  label: string
  title: string
  subtitle: string
}

export function ClassHero({ label, title, subtitle }: ClassHeroProps) {
  return (
    <header className="bg-[#E4E0D9] px-6 pb-16 pt-40 text-center md:px-12 md:pb-24 md:pt-48 lg:px-16">
      <span className="mono text-dot-primary">{label}</span>
      <h1 className="mt-2 font-serif text-3xl font-normal tracking-[0.12em] text-dot-primary md:text-4xl lg:text-[3.5rem]">
        {title}
      </h1>
      <p className="mono mt-4 text-dot-primary/60">{subtitle}</p>
    </header>
  )
}
