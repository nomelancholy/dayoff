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

/** 네이버 예약 링크 – .env (VITE_CLASS_BOOKING_*) 로 오버라이드 가능 */
const NAVER_BASE = 'https://m.booking.naver.com/booking/6/bizes/1177496'
const booking = {
  wheel:
    (import.meta.env.VITE_CLASS_BOOKING_WHEEL as string) ||
    `${NAVER_BASE}/items/6731133?area=ple&lang=ko&tab=book&theme=place`,
  colorClay:
    (import.meta.env.VITE_CLASS_BOOKING_COLOR_CLAY as string) ||
    `${NAVER_BASE}/items/6581778?area=bmp&lang=ko&tab=book&theme=place`,
  freeForm:
    (import.meta.env.VITE_CLASS_BOOKING_FREE_FORM as string) ||
    `${NAVER_BASE}/items/5955427?area=ple&lang=ko&tab=book&theme=place`,
} as const

export const CLASS_ITEMS: ClassItemData[] = [
  {
    id: 'wheel',
    slug: 'wheel',
    monoLabel: 'WHEEL THROWING',
    name: '물레 클래스',
    image: '/class/pottery_wheel_thumbnail.jpg',
    imageAlt: '물레 클래스',
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
    image: '/class/color_thumbnail.jpg',
    imageAlt: '컬러 클레이 클래스',
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
    image: '/class/free_thumbnail.jpg',
    imageAlt: '자유 원데이 클래스',
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
      '"작가님이 너무 친절하시고 재밌는 시간이었어요❤️ 색소지 수업 듣고 싶었는데 색 제한도 없고 자유롭게 만들 수 있게 도와주셔서 너무너무 좋았어요! 수업시간 두시간동안 마블 하나 색소지작품 하나 만드는 수업인데 개인적으로 색소지가 너무너무 재미있어서 색소지만 이루어진 수업 있었음 좋겠다고 생각했어요! 공부도 이야기가하고 귀엽고 작가님의 설명도 자세하고 친절하시구 많이 도와주셔서 완성도 높은 물건을 얻는다는 생각이 들었어요."',
    author: '찜찜박사',
  },
  {
    quote:
      '"지난번에 원데이 클래스 듣고 정말 만족해서 한 번 더 방문했습니다! 크리스마스 맞이 머그컵과 접시를 만들고 싶었어요!! 원하는 느낌대로 컵이랑 접시를 만들 수 있어서 정말 좋았습니다. 무엇보다 크리스마스 리스+산타토끼 조합의 접시가 너무너무 만족스러워요!!!! 얼른 완성된 작품을 받고싶어요.🙏"',
    author: 'haennana',
  },
  {
    quote:
      '"친절하신 사장님 쾌적한 공간 맛있는 음료 💖 덕분에 두 시간이라는 시간이 훌쩍 지나갈 정도로 재미있는 시간 보냈고 왔어요 🥰 친구랑 둘 다 흙을 처음 만지는 데 원하는 모양 만들 수 있게 친절하게 알려 주셔서 쉽게 만들 수 있었어요! 흙이 생각보다 다루기 쉽진 않았는데 힘들어하는 부분은 사장님께서 똑똑 해결해 주셨어요 ㅋㅋㅋ 🥹 사장님께서 만들어서 판매하시는 컵도 너무 예뻐서 하나 골라서 구매했어요 ㅎㅎ 완성까지 한 달 정도 걸린다고 하셨는데 너무 기대됩니다 🙌"',
    author: '빵쪼아인간',
  },
]
