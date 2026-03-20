type SectionTextProps = {
  label?: string
  title: string
  paragraphs: string[]
  className?: string
}

export function SectionText({
  label,
  title,
  paragraphs,
  className = '',
}: SectionTextProps) {
  return (
    <div className={className}>
      <span className="mono text-dot-primary">{label}</span>
      <h2
        className="mt-4 text-xl font-normal leading-snug tracking-[0.12em] text-dot-primary md:text-2xl"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className="mt-8 text-[1.1rem] font-light leading-relaxed text-dot-secondary"
          dangerouslySetInnerHTML={{ __html: p }}
        />
      ))}
    </div>
  )
}
