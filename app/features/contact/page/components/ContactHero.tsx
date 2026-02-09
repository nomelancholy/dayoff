type ContactHeroProps = {
  label: string
  title: string
  subtitle: string
}

export function ContactHero({ label, title, subtitle }: ContactHeroProps) {
  return (
    <header className="bg-[#E8E6E1] px-6 pb-16 pt-40 text-center md:px-12 md:pb-24 md:pt-48 lg:px-16">
      <span className="mono text-dot-primary">{label}</span>
      <h1 className="mt-2 font-serif text-3xl font-normal tracking-[0.12em] text-dot-primary md:text-4xl lg:text-5xl">
        {title}
      </h1>
      <p className="mono mt-6 text-dot-primary/60">{subtitle}</p>
    </header>
  )
}
