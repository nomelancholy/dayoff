type ClassHeroProps = {
  label: string
  title: string
  subtitle: string
}

export function ClassHero({ label, title, subtitle }: ClassHeroProps) {
  return (
    <header className="bg-[#E4E0D9] px-6 pb-24 pt-48 text-center md:px-16 md:pb-32 md:pt-60">
      <span className="mono text-dot-primary">{label}</span>
      <h1 className="mt-4 font-serif text-4xl font-normal tracking-[0.12em] text-dot-primary md:text-5xl lg:text-[3.5rem]">
        {title}
      </h1>
      <p className="mono mt-4 text-dot-primary/60">{subtitle}</p>
    </header>
  )
}
