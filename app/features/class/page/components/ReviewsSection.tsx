import { CLASS_REVIEWS } from '../classData'

export function ReviewsSection() {
  return (
    <section className="bg-dot-surface px-6 py-24 md:px-12 md:py-32 lg:px-16">
      <div className="reveal-element mb-24 text-center">
        <span className="mono text-dot-primary">TESTIMONIALS</span>
        <h2 className="mt-2 font-serif text-3xl font-normal tracking-[0.12em] text-dot-primary">
          Our Students
        </h2>
      </div>
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 md:grid-cols-3">
        {CLASS_REVIEWS.map((review, i) => (
          <div
            key={i}
            className="reveal-element rounded-sm bg-dot-bg px-8 py-12 text-center"
          >
            <p className="mb-6 text-[0.95rem] italic leading-relaxed text-dot-secondary">
              {review.quote}
            </p>
            <div className="mono font-medium text-dot-primary">{review.author}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
