type PhilosophySectionProps = {
  label: string
  title: string
  content: string
}

export function PhilosophySection({ label, title, content }: PhilosophySectionProps) {
  return (
    <section className="bg-[#1A1A1A] px-6 py-24 text-center md:px-16 md:py-40">
      <div className="reveal-element mx-auto max-w-[800px]">
        <span className="mono text-[#F9F8F6]/80">{label}</span>
        <h2 className="mt-6 text-3xl font-normal tracking-[0.12em] text-[#F9F8F6] md:text-4xl">
          {title}
        </h2>
        <p className="mt-12 text-lg font-light leading-relaxed text-[#F9F8F6]">
          {content}
        </p>
      </div>
    </section>
  )
}
