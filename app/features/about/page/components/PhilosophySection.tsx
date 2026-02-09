type PhilosophySectionProps = {
  label: string
  title: string
  content: string
}

export function PhilosophySection({ label, title, content }: PhilosophySectionProps) {
  return (
    <section className="bg-dot-primary px-6 py-24 text-center md:px-12 lg:px-16">
      <div className="reveal-element mx-auto max-w-[800px]">
        <span className="mono text-dot-accent">{label}</span>
        <h2 className="mt-4 text-3xl font-normal tracking-[0.12em] text-dot-bg md:text-4xl">
          {title}
        </h2>
        <p className="mt-12 text-lg font-light leading-relaxed text-dot-bg/90">
          {content}
        </p>
      </div>
    </section>
  )
}
