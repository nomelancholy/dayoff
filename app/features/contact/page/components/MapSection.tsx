import { MapPin } from 'lucide-react'
import { MAP_LINKS } from '../contactData'

/** 지도 영역. VITE_GOOGLE_MAP_EMBED_URL 등으로 iframe 교체 가능 */
export function MapSection() {
  const embedUrl = import.meta.env.VITE_GOOGLE_MAP_EMBED_URL as string | undefined

  return (
    <div className="reveal-element h-[400px] w-full overflow-hidden rounded-sm bg-[#f0f0f0] md:h-[500px]">
      {embedUrl ? (
        <iframe
          title="지도"
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#f0f0f0] text-dot-secondary">
          <MapPin size={32} className="text-dot-accent" />
          <span className="mono text-dot-primary">MAP VIEW</span>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <a
              href={MAP_LINKS.kakao}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dot-primary underline underline-offset-2 hover:text-dot-accent"
            >
              카카오맵에서 보기
            </a>
            <a
              href={MAP_LINKS.google}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dot-primary underline underline-offset-2 hover:text-dot-accent"
            >
              Google 지도에서 보기
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
