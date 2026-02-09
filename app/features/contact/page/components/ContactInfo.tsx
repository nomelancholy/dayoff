import { Instagram, Link as LinkIcon } from 'lucide-react'
import { CONTACT_INFO } from '../contactData'

export function ContactInfo() {
  const lines = CONTACT_INFO.openingHours.split('\n')

  return (
    <div className="reveal-element">
      <span className="mono text-dot-primary">LOCATION & CONTACT</span>
      <h2 className="mt-4 font-serif text-2xl font-normal leading-snug tracking-[0.12em] text-dot-primary md:text-3xl">
        숨어있는 조용한 감각,
        <br />
        공방 DOT.로 오시는 길
      </h2>

      <div className="mt-12 space-y-10">
        <div>
          <h3 className="mono mb-2 text-[0.8rem] text-dot-accent">ADDRESS</h3>
          <p className="text-[1.2rem] font-light text-dot-primary">{CONTACT_INFO.address}</p>
        </div>
        <div>
          <h3 className="mono mb-2 text-[0.8rem] text-dot-accent">EMAIL</h3>
          <a
            href={`mailto:${CONTACT_INFO.email}`}
            className="text-[1.2rem] font-light text-dot-primary no-underline transition-(--dot-transition) hover:text-dot-accent"
          >
            {CONTACT_INFO.email}
          </a>
        </div>
        <div>
          <h3 className="mono mb-2 text-[0.8rem] text-dot-accent">OPENING HOURS</h3>
          <p className="text-[1.2rem] font-light text-dot-primary">
            {lines.map((line, i) => (
              <span key={i}>
                {line}
                {i < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="mono mt-16 flex flex-wrap gap-8">
        <a
          href={CONTACT_INFO.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[0.9rem] text-dot-primary no-underline transition-(--dot-transition) hover:text-dot-accent"
        >
          <Instagram size={18} />
          INSTAGRAM
        </a>
        <a
          href={CONTACT_INFO.blogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[0.9rem] text-dot-primary no-underline transition-(--dot-transition) hover:text-dot-accent"
        >
          <LinkIcon size={18} />
          BLOG
        </a>
      </div>
    </div>
  )
}
