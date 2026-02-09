import { useReveal } from '@/common/hooks/useReveal'
import { ClassHero, ClassList, ReviewsSection } from './components'

export const ClassPage = () => {
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      <ClassHero
        label="ONE DAY EXPERIENCE"
        title="Handmade Ritual"
        subtitle="Touch the clay, find your stillness"
      />
      <ClassList />
      <ReviewsSection />
    </div>
  )
}
