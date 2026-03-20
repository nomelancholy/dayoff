type GalleryItemProps = {
  src: string
  alt: string
}

function GalleryItem({ src, alt }: GalleryItemProps) {
  return (
    <div className="reveal-element relative w-full max-w-[920px] overflow-hidden rounded-sm">
      <img
        src={src}
        alt={alt}
        className="block h-auto w-full transition-transform duration-[1.2s] ease-out hover:scale-[1.02]"
      />
    </div>
  )
}

const GALLERY_ITEMS = [
  {
    src: '/assets/IMG_31262.jpg',
    alt: 'Ceramic cup and plate',
  },
  {
    src: '/assets/IMG_8854.jpg',
    alt: 'Pottery detail',
  },
] as const

export function GallerySection() {
  return (
    <section className="bg-dot-surface px-6 py-20 pb-32 md:px-12 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col items-center gap-10 md:gap-14">
          {GALLERY_ITEMS.map((item, i) => (
            <GalleryItem key={i} src={item.src} alt={item.alt} />
          ))}
        </div>
      </div>
    </section>
  )
}
