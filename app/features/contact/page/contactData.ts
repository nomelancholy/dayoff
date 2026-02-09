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
      {
        stepNumber: 'STEP 01',
        image: 'https://images.unsplash.com/photo-1542640244-7e672d6cef21?auto=format&fit=crop&q=80&w=800',
        imageAlt: 'Step 1',
        text: '충무로역 7번 출구로 나와서 직진합니다.',
      },
      {
        stepNumber: 'STEP 02',
        image: 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&q=80&w=800',
        imageAlt: 'Step 2',
        text: '간판 가게를 끼고 오른쪽 골목으로 들어오세요.',
      },
      {
        stepNumber: 'STEP 03',
        image: 'https://images.unsplash.com/photo-1565191999001-551c187427bb?auto=format&fit=crop&q=80&w=800',
        imageAlt: 'Step 3',
        text: '통일집 간판 뒤 DOT 간판을 찾으시면 계단을 올라오세요.',
      },
    ],
  },
  {
    id: 'euljiro',
    label: '을지로3가역 8번 출구 기준',
    steps: [
      {
        stepNumber: 'STEP 01',
        image: 'https://images.unsplash.com/photo-1449444004900-5895743c3917?auto=format&fit=crop&q=80&w=800',
        imageAlt: 'Step 1',
        text: '을지로3가역 8번 출구에서 직진하여 첫 번째 골목으로 들어오세요.',
      },
      {
        stepNumber: 'STEP 02',
        image: 'https://images.unsplash.com/photo-1578507065211-1c4e99a5fd24?auto=format&fit=crop&q=80&w=800',
        imageAlt: 'Step 2',
        text: '첫 번째 골목에서 왼쪽을 보시면 골목 안쪽에 DOT이 있습니다.',
      },
      {
        stepNumber: 'STEP 03',
        image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=800',
        imageAlt: 'Step 3',
        text: '골목 끝까지 들어오셔서 계단을 올라오시면 DOT 스튜디오입니다.',
      },
    ],
  },
]
