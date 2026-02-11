import { CLASS_REVIEWS } from '../classData'

/** reference: class.html .section-reviews, .review-header, .review-grid, .review-card */
export function ReviewsSection() {
  return (
    <section
      className="bg-white px-6 py-40 md:px-16"
      aria-labelledby="reviews-heading"
    >
      <div className="reveal-element mb-24 text-center">
        <span className="mono text-dot-primary">TESTIMONIALS</span>
        <h2
          id="reviews-heading"
          className="mt-2 font-serif text-4xl font-normal tracking-[0.12em] text-dot-primary"
        >
          Our Students
        </h2>
      </div>
      <div className="review-grid mx-auto grid max-w-[1200px] grid-cols-1 gap-8 md:grid-cols-3">
        {CLASS_REVIEWS.map((review, i) => (
          <div
            key={i}
            className="reveal-element review-card rounded-[2px] bg-dot-bg px-8 py-12 text-center"
          >
            <p className="mb-6 text-[0.95rem] italic leading-relaxed text-dot-secondary">
              {review.quote}
            </p>
            <div className="review-author mono font-medium text-dot-primary">
              {review.author}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
