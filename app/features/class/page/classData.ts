/** 원데이 클래스 소개 데이터 (추후 DB/API 연동 가능) */
export type ClassInfoRow = { label: string; value: string }

export type ClassItemData = {
  id: string
  slug: string
  monoLabel: string
  name: string
  image: string
  imageAlt: string
  infoRows: ClassInfoRow[]
  description: string
  /** 네이버 예약 링크 (또는 자체 예약 URL) */
  bookingUrl: string
}

/** 네이버 예약 링크 – 실제 운영 시 .env (VITE_CLASS_BOOKING_*) 로 교체 권장 */
const booking = {
  wheel: import.meta.env.VITE_CLASS_BOOKING_WHEEL,
  colorClay: import.meta.env.VITE_CLASS_BOOKING_COLOR_CLAY,
  freeForm: import.meta.env.VITE_CLASS_BOOKING_FREE_FORM,
} as const

export const CLASS_ITEMS: ClassItemData[] = [
  {
    id: 'wheel',
    slug: 'wheel',
    monoLabel: 'WHEEL THROWING',
    name: '물레 클래스',
    image: 'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?auto=format&fit=crop&q=80&w=1000',
    imageAlt: 'Wheel Class',
    infoRows: [
      { label: 'TIME', value: '90분' },
      { label: 'ITEMS', value: '1인 2기물 제작' },
      { label: 'LEVEL', value: '입문자 가능' },
    ],
    description:
      '빙글빙글 돌아가는 물레 위에서 흙의 중심을 잡으며 오롯이 손끝의 감각에 집중합니다. 도자공예 전공 선생님의 지도 아래, 백자 흙으로 자신만의 기물을 빚어보세요. 유광 또는 무광 중 선택하여 마감할 수 있습니다.',
    bookingUrl: booking.wheel,
  },
  {
    id: 'color-clay',
    slug: 'color-clay',
    monoLabel: 'COLOR CLAY',
    name: '컬러 클레이 클래스',
    image: 'https://images.unsplash.com/photo-1565191999001-551c187427bb?auto=format&fit=crop&q=80&w=1000',
    imageAlt: 'Color Clay Class',
    infoRows: [
      { label: 'TIME', value: '90 - 120분' },
      { label: 'METHOD', value: '연리문 기법' },
      { label: 'RESULT', value: '자유로운 패턴의 그릇' },
    ],
    description:
      "색을 입힌 흙들을 조합해 우연한 무늬를 만들어내는 '연리문' 기법을 배웁니다. 알록달록한 색소지를 활용해 캐릭터나 꽃, 기하학 패턴 등 자신만의 개성을 듬뿍 담은 그릇을 완성할 수 있는 디오티의 인기 클래스입니다.",
    bookingUrl: booking.colorClay,
  },
  {
    id: 'free',
    slug: 'free',
    monoLabel: 'FREE FORMING',
    name: '자유 원데이 클래스',
    image: 'https://images.unsplash.com/photo-1525673812760-73892330773b?auto=format&fit=crop&q=80&w=1000',
    imageAlt: 'Free Class',
    infoRows: [
      { label: 'TIME', value: '120분' },
      { label: 'ITEMS', value: '대형 1개 또는 중소형 2개' },
      { label: 'STYLE', value: '핸드빌딩 & 페인팅' },
    ],
    description:
      '정해진 형식 없이 자유롭게 흙을 만지며 원하는 오브제를 만듭니다. 화병, 큰 접시, 소쿠리 등 다양한 형태를 시도해 볼 수 있으며, 물감을 이용해 직접 그림을 그리거나 무늬를 새기는 작업도 가능합니다.',
    bookingUrl: booking.freeForm,
  },
]

export type ReviewData = { quote: string; author: string }

export const CLASS_REVIEWS: ReviewData[] = [
  {
    quote:
      '"처음 물레를 돌려봤는데 선생님이 친절하게 가르쳐주셔서 너무 즐거웠어요. 완성된 컵도 너무 예뻐요!"',
    author: 'Minsu Kim',
  },
  {
    quote:
      '"컬러 클레이 클래스에서 만든 접시 볼 때마다 기분이 좋아져요. 흙을 만지는 시간 자체가 힐링이었습니다."',
    author: 'Sarah Lee',
  },
  {
    quote: '"자유 클래스에서 화병을 만들었는데, 제 손으로 직접 만든 거라 더 애착이 가네요. 조만간 또 가려구요."',
    author: 'Jihoo Park',
  },
]
