import { useReveal } from '@/common/hooks/useReveal'
import {
  ContactHero,
  ContactInfo,
  MapSection,
  WayfindingSection,
} from './components'

export const ContactPage = () => {
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      <ContactHero
        label="GET IN TOUCH"
        title="Visit Our Studio"
        subtitle="A quiet space for ceramic art in the heart of the city"
      />

      <main className="mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32 lg:px-16">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:gap-24">
          <ContactInfo />
          <MapSection />
        </div>
      </main>

      <WayfindingSection />
    </div>
  )
}
