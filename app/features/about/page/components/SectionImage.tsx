type SectionImageProps = {
  src: string
  alt: string
  className?: string
}

export function SectionImage({ src, alt, className = '' }: SectionImageProps) {
  return (
    <div className={`overflow-hidden rounded-sm ${className}`}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-105"
      />
    </div>
  )
}
