/** 연락처·찾아오는 길 데이터 (추후 DB/API 연동 가능) */

export const CONTACT_INFO = {
  address: '서울특별시 중구 을지로동 (충무로역/을지로3가역 인근)',
  email: 'hello@dotceramic.com',
  openingHours: 'Tue - Sun | 11:00 - 20:00\nMonday Closed',
  /** 인스타그램 프로필 URL */
  instagramUrl: 'https://www.instagram.com/',
  /** 블로그 URL */
  blogUrl: 'https://blog.naver.com/',
} as const

/** 지도에서 보기 링크 (카카오맵 검색어 또는 주소) */
export const MAP_LINKS = {
  kakao: 'https://map.kakao.com/?q=을지로동+서울+공방',
  google: 'https://www.google.com/maps/search/을지로동+서울',
} as const

export type WayfindingStep = {
  stepNumber: string
  image: string
  imageAlt: string
  text: string
}

export type WayfindingRoute = {
  id: string
  label: string
  steps: WayfindingStep[]
}

export const WAYFINDING_ROUTES: WayfindingRoute[] = [
  {
    id: 'chungmuro',
    label: '충무로역 7번 출구 기준',
    steps: [
      { stepNumber: 'STEP 01', image: '/contact/chung_01.jpg', imageAlt: '충무로 1단계', text: '충무로역 7번 출구로 나와서' },
      { stepNumber: 'STEP 02', image: '/contact/chung_02.jpg', imageAlt: '충무로 2단계', text: '쭉 직진합니다' },
      { stepNumber: 'STEP 03', image: '/contact/chung_03.jpg', imageAlt: '충무로 3단계', text: '간판 가게를 끼고 오른쪽을 보면' },
      { stepNumber: 'STEP 04', image: '/contact/chung_04.jpg', imageAlt: '충무로 4단계', text: '길로 들어와서' },
      { stepNumber: 'STEP 05', image: '/contact/chung_05.jpg', imageAlt: '충무로 5단계', text: '첫번째 골목에서 왼쪽을 보시면' },
      { stepNumber: 'STEP 06', image: '/contact/chung_06.jpg', imageAlt: '충무로 6단계', text: '통일집 간판 뒤에 DOT 간판 있습니다' },
      { stepNumber: 'STEP 07', image: '/contact/chung_07.jpg', imageAlt: '충무로 7단계', text: '내려옵니다' },
      { stepNumber: 'STEP 08', image: '/contact/chung_08.jpg', imageAlt: '충무로 8단계', text: '그 골목으로 들어오셔서' },
      { stepNumber: 'STEP 09', image: '/contact/chung_09.jpg', imageAlt: '충무로 9단계', text: '계단을 올라오시면' },
      { stepNumber: 'STEP 10', image: '/contact/chung_10.jpg', imageAlt: '충무로 10단계', text: '어세오세요 DOT입니다' },
    ],
  },
  {
    id: 'euljiro',
    label: '을지로3가역 8번 출구 기준',
    steps: [
      { stepNumber: 'STEP 01', image: '/contact/eul_01.jpg', imageAlt: '을지로 1단계', text: '을지로 3가역 8번 출구로 나와서' },
      { stepNumber: 'STEP 02', image: '/contact/eul_02.jpg', imageAlt: '을지로 2단계', text: '쭉 진진합니다.' },
      { stepNumber: 'STEP 03', image: '/contact/eul_03.jpg', imageAlt: '을지로 3단계', text: '사거리에서도 직진합니다' },
      { stepNumber: 'STEP 04', image: '/contact/eul_04.jpg', imageAlt: '을지로 4단계', text: '청기와타운을 지나면 왼쪽에 작은 골목이 있습니다' },
      { stepNumber: 'STEP 05', image: '/contact/eul_05.jpg', imageAlt: '을지로 5단계', text: '그 골목으로 들어오면' },
      { stepNumber: 'STEP 06', image: '/contact/eul_06.jpg', imageAlt: '을지로 6단계', text: '우측 10시 방향에' },
      { stepNumber: 'STEP 07', image: '/contact/eul_07.jpg', imageAlt: '을지로 7단계', text: 'DOT 간판이 작게 걸려있습니다' },
      { stepNumber: 'STEP 08', image: '/contact/eul_08.jpg', imageAlt: '을지로 8단계', text: '그 골목으로 들어오셔서' },
      { stepNumber: 'STEP 09', image: '/contact/eul_09.jpg', imageAlt: '을지로 9단계', text: '계단을 올라오시면' },
      { stepNumber: 'STEP 10', image: '/contact/eul_10.jpg', imageAlt: '을지로 10단계', text: '어세오세요 DOT입니다' },
    ],
  },
]
