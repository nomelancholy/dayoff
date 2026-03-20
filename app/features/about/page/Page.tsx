import { useReveal } from '@/common/hooks/useReveal'
import { AboutHero, GallerySection, StorySection } from './components'

export const AboutPage = () => {
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      <AboutHero label="ABOUT" title="Day Off Today" />
      <StorySection />
      <GallerySection />
    </div>
  )
}
