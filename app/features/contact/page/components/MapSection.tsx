import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { CONTACT_INFO, MAP_LINKS, MAP_POSITION } from '../contactData'

const SCRIPT_ID = 'naver-map-script'

function initializeMap(container: HTMLDivElement) {
  if (!window.naver?.maps) return

  const position = new window.naver.maps.LatLng(MAP_POSITION.lat, MAP_POSITION.lng)
  const map = new window.naver.maps.Map(container, {
    center: position,
    zoom: 16,
  })

  const marker = new window.naver.maps.Marker({
    position,
    map,
  })

  const infoWindow = new window.naver.maps.InfoWindow({
    content: `
      <div style="padding:12px;font-size:14px;line-height:1.5;min-width:180px;">
        <p style="margin:0 0 8px;font-weight:500;">공방 DOT.</p>
        <p style="margin:0 0 8px;color:#333;">${CONTACT_INFO.address}</p>
        <a href="${MAP_LINKS.naver}" target="_blank" rel="noopener noreferrer" style="color:#03C75A;text-decoration:underline;">
          네이버 지도에서 보기
        </a>
      </div>
    `,
  })

  window.naver.maps.Event.addListener(marker, 'click', () => {
    infoWindow.open(map, marker)
  })

  infoWindow.open(map, marker)
}

/** 네이버 지도 영역. VITE_NAVER_MAP_CLIENT_ID 설정 시 지도 표시, 미설정 시 링크만 표시 */
export function MapSection() {
  const mapRef = useRef<HTMLDivElement>(null)
  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined

  useEffect(() => {
    if (!clientId || !mapRef.current) return

    const runInit = () => {
      if (mapRef.current && window.naver?.maps) {
        initializeMap(mapRef.current)
      }
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      runInit()
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`
    script.async = true
    script.onload = runInit
    document.body.appendChild(script)
  }, [clientId])

  if (!clientId) {
    return (
      <div className="reveal-element h-[400px] w-full overflow-hidden rounded-sm bg-[#f0f0f0] md:h-[500px]">
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#f0f0f0] text-dot-secondary">
          <MapPin size={32} className="text-dot-accent" />
          <span className="mono text-dot-primary">MAP VIEW</span>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <a
              href={MAP_LINKS.naver}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dot-primary underline underline-offset-2 hover:text-dot-accent"
            >
              네이버 지도에서 보기
            </a>
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
      </div>
    )
  }

  return (
    <div className="reveal-element h-[400px] w-full overflow-hidden rounded-sm bg-[#f0f0f0] md:h-[500px]">
      <div
        ref={mapRef}
        className="h-full w-full"
        aria-label="공방 위치 지도"
      />
    </div>
  )
}
