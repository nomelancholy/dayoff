type GalleryItemProps = {
  src: string
  alt: string
  className?: string
}

function GalleryItem({ src, alt, className = '' }: GalleryItemProps) {
  return (
    <div className={`reveal-element relative overflow-hidden rounded-sm ${className}`}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-105"
      />
    </div>
  )
}

const GALLERY_ITEMS = [
  {
    src: 'https://images.unsplash.com/photo-1565191999001-551c187427bb?auto=format&fit=crop&q=80&w=1000',
    alt: 'Process',
    gridClass: 'col-span-full md:col-span-5 md:row-start-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1502159212845-f3169998e367?auto=format&fit=crop&q=80&w=1200',
    alt: 'Pottery collection',
    gridClass: 'col-span-full md:col-span-7 md:col-start-6 md:row-start-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1525673812760-73892330773b?auto=format&fit=crop&q=80&w=1200',
    alt: 'Mugs',
    gridClass: 'col-span-full md:col-span-7 md:row-start-2',
  },
  {
    src: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=800',
    alt: 'Vase',
    gridClass: 'col-span-full md:col-span-5 md:col-start-8 md:row-start-2',
  },
] as const

export function GallerySection() {
  return (
    <section className="bg-dot-surface px-6 py-20 pb-32 md:px-12 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <div className="reveal-element mb-24 text-center">
          <span className="mono text-dot-primary">ARCHIVE</span>
          <h2 className="mt-2 font-serif text-3xl font-normal tracking-[0.12em] text-dot-primary">
            OUR CREATIONS
          </h2>
        </div>
        <div className="grid grid-cols-12 gap-8 max-md:auto-rows-[300px] max-md:grid-cols-1 max-md:grid-rows-4 md:grid-rows-[400px_400px]">
          {GALLERY_ITEMS.map((item, i) => (
            <GalleryItem
              key={i}
              src={item.src}
              alt={item.alt}
              className={item.gridClass}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
