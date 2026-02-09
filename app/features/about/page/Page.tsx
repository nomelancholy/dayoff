import { useReveal } from '@/common/hooks/useReveal'
import { AboutHero, GallerySection, PhilosophySection, StorySection } from './components'

const PHILOSOPHY = {
  label: 'PHILOSOPHY',
  title: 'Less, but Better.',
  content:
    '복잡한 수식보다는 간결한 선을, 화려한 색채보다는 흙 본연의 색을 지향합니다. 불필요한 것을 덜어내고 남은 본질적인 아름다움이 당신의 일상에 깊이 스며들기를 바랍니다.',
} as const

export const AboutPage = () => {
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      <AboutHero label="DISCOVER OUR JOURNEY" title="Crafted Silence" />
      <StorySection />
      <GallerySection />
      <PhilosophySection
        label={PHILOSOPHY.label}
        title={PHILOSOPHY.title}
        content={PHILOSOPHY.content}
      />
    </div>
  )
}
