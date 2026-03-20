import { useReveal } from '@/common/hooks/useReveal'
import { ClassList, ReviewsSection } from './components'

export const ClassPage = () => {
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      <ClassList />
      <ReviewsSection />
    </div>
  )
}
