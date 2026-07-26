import { Instagram, Link as LinkIcon } from 'lucide-react'
import { CONTACT_INFO } from '../contactData'

export function ContactInfo() {
  return (
    <div className="reveal-element">
      <div className="mt-12 space-y-10">
        <div>
          <h3 className="mono mb-2 text-[0.8rem] text-dot-accent">ADDRESS</h3>
          <p className="text-[1.2rem] font-light text-dot-primary">
            {CONTACT_INFO.address}
          </p>
        </div>
        <div>
          <h3 className="mono mb-2 text-[0.8rem] text-dot-accent">EMAIL</h3>
          <a
            href={`mailto:${CONTACT_INFO.email}`}
            className="text-[1.2rem] font-light! text-dot-primary no-underline transition-(--dot-transition) hover:text-dot-accent"
          >
            {CONTACT_INFO.email}
          </a>
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-8 sm:flex-row sm:gap-12">
        <a
          href={CONTACT_INFO.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 text-dot-primary no-underline transition-(--dot-transition) hover:text-dot-accent"
        >
          <Instagram size={18} className="mt-0.5 shrink-0" />
          <span className="flex flex-col gap-1">
            <span className="mono text-[0.8rem]">INSTAGRAM</span>
            <span className="text-sm font-light tracking-normal text-dot-secondary normal-case group-hover:text-dot-accent">
              instagram.com/dot_sej
            </span>
          </span>
        </a>
        <a
          href={CONTACT_INFO.blogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 text-dot-primary no-underline transition-(--dot-transition) hover:text-dot-accent"
        >
          <LinkIcon size={18} className="mt-0.5 shrink-0" />
          <span className="flex flex-col gap-1">
            <span className="mono text-[0.8rem]">BLOG</span>
            <span className="text-sm font-light tracking-normal text-dot-secondary normal-case group-hover:text-dot-accent">
              blog.naver.com/eundi2c
            </span>
          </span>
        </a>
      </div>
    </div>
  )
}
