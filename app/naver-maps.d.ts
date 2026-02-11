/** 네이버 지도 API (동적 스크립트 로드 시 사용) */
declare global {
  interface Window {
    naver?: {
      maps: {
        LatLng: new (lat: number, lng: number) => { lat: number; lng: number }
        Map: new (el: HTMLElement, options: { center: unknown; zoom: number }) => unknown
        Marker: new (options: { position: unknown; map: unknown }) => unknown
        InfoWindow: new (options: { content: string }) => {
          open: (map: unknown, marker: unknown) => void
        }
        Event: {
          addListener: (target: unknown, event: string, handler: () => void) => void
        }
      }
    }
  }
}

export {}
