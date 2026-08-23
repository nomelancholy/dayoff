import { useReveal } from '@/common/hooks/useReveal'
import {
  PortfolioSeriesSection,
  type PortfolioSeries,
} from './components/PortfolioSeriesSection'

const ABOUT_IMAGES = '/assets/about'

const SERIES: readonly PortfolioSeries[] = [
  {
    number: '01',
    subtitle: '전통문양 다과상 트레이 세트',
    title: '전통문양 다과상 트레이 세트',
    description: [
      '한국 전통 문양을 모티브로 만들어낸 트레이와 컵 세트입니다.',
      '부드럽게 굴곡진 외곽선은 식탁 위에 시각적인 온기를 만들어 냅니다.',
    ],
    material: '슈퍼슬립 / 산화 소성',
    cover: {
      src: `${ABOUT_IMAGES}/image30.jpg`,
      alt: '전통문양 트레이와 찻잔으로 구성한 다과상',
    },
    gallery: [
      {
        src: `${ABOUT_IMAGES}/image29.jpg`,
        alt: '육각형과 화형 전통문양 트레이',
      },
      {
        src: `${ABOUT_IMAGES}/image18.jpg`,
        alt: '서로 다른 유약 색의 전통문양 찻잔',
      },
    ],
  },
  {
    number: '02',
    subtitle: '미세한 굴곡과 은은한 음영',
    title: 'Moon Pasta Bowl',
    description: [
      '자연의 색채와 질감을 표현하기 위해 만들어낸 유약을 발라 은은한 음영을 구현했습니다.',
      '식탁 위에서 고요한 밤하늘을 연상하며 휴식을 취할 수 있는 경험을 만들어냅니다. 손가락이 닿는 골짜기마다 달라지는 유약의 흘러내림은 기물 고유의 유일한 그라데이션을 연출합니다.',
    ],
    material: '백자 / 산화 소성',
    cover: {
      src: `${ABOUT_IMAGES}/image10.jpg`,
      alt: '은은한 흑백 그라데이션의 문 파스타 보울',
    },
    gallery: [
      {
        src: `${ABOUT_IMAGES}/image17.jpg`,
        alt: '세 점의 문 파스타 보울',
      },
      {
        src: `${ABOUT_IMAGES}/image9.jpg`,
        alt: '측면에서 본 문 파스타 보울',
      },
    ],
  },
  {
    number: '03',
    subtitle: '봉오리를 닮은 사발',
    title: 'Flower-Shaped Bowl',
    description: [
      '화려하지 않은 백자의 자연스러운 톤은 본질에 충실합니다. 네 면에 선을 넣어 전통문양인 화형문양을 만들었습니다.',
      '음식을 담아 그 자체로 작품처럼 돋보이게 하는 아름다운 여백과 높이의 대비를 선사합니다.',
    ],
    material: '백자 / 산화 소성',
    cover: {
      src: `${ABOUT_IMAGES}/image25.jpg`,
      alt: '겹쳐 놓은 플라워 쉐입 보울',
    },
    gallery: [
      {
        src: `${ABOUT_IMAGES}/image24.jpg`,
        alt: '세 점의 플라워 쉐입 보울 정면',
      },
      {
        src: `${ABOUT_IMAGES}/image21.jpg`,
        alt: '플라워 쉐입 보울의 굽과 내부',
      },
    ],
  },
  {
    number: '04',
    subtitle: '흐르는 자연의 빛깔',
    title: 'Pebble Vase',
    description: [
      '두 가지 이상의 유약이 만나 결정이 피고 유리질의 맺힘에 따라 자연의 빛깔을 만들어 냅니다.',
      '물레로 제작한 백자 특유의 맑은 태토(胎土)는 그 위에 얹어진 산화물 발색제 본연의 색채와 질감을 전면에 드러냅니다.',
    ],
    material: '백자 / 산화 소성',
    cover: {
      src: `${ABOUT_IMAGES}/image31.jpg`,
      alt: '자연스러운 유약 색을 입힌 패블 베이스',
    },
    gallery: [
      {
        src: `${ABOUT_IMAGES}/image28.jpg`,
        alt: '여러 색의 패블 베이스',
      },
      {
        src: `${ABOUT_IMAGES}/image27.jpg`,
        alt: '일렬로 놓인 패블 베이스',
      },
    ],
  },
  {
    number: '05',
    subtitle: '달빛이 내려앉은 그릇',
    title: 'Lunamatt Pasta Bowl (윤슬달)',
    description: [
      '백자 위 미색 유약이 표현하는 은은한 달빛과 고요한 밤의 분위기를 빚은 파스타 보울입니다.',
      '윤슬달은 달빛이 비쳐 은은하게 빛나는 표면을 뜻합니다. ‘Lunamatt’는 달을 뜻하는 ‘Luna’와 무광 유약의 ‘Matt’를 결합해 미색 무광 파스타 보울의 정체성을 담았습니다.',
    ],
    material: '백자 / 산화 소성',
    cover: {
      src: `${ABOUT_IMAGES}/image23.jpg`,
      alt: '채소를 담은 윤슬달 파스타 보울',
    },
    gallery: [
      {
        src: `${ABOUT_IMAGES}/image26.jpg`,
        alt: '위에서 본 윤슬달 파스타 보울',
      },
      {
        src: `${ABOUT_IMAGES}/image32.jpg`,
        alt: '윤슬달 파스타 보울 한 점',
      },
    ],
  },
]

export const AboutPage = () => {
  const revealRef = useReveal()

  return (
    <div ref={revealRef} className="bg-dot-bg">
      <section className="portfolio-grid relative flex min-h-[88svh] items-end overflow-hidden px-6 pb-16 pt-32 md:px-12 md:pb-24 md:pt-40 lg:px-16">
        <div className="mx-auto w-full max-w-[1500px]">
          <p className="reveal-element font-serif text-base italic text-[#958878] md:text-lg">
            Ceramic artist portfolio
          </p>
          <div className="reveal-element mt-16 max-w-[1100px] md:mt-24">
            <div className="mb-7 h-16 w-20 overflow-hidden md:h-20 md:w-24">
              <img
                src="/assets/dot_mark.png"
                alt="휴(休)"
                className="h-full w-full scale-[1.75] object-contain mix-blend-multiply"
              />
            </div>
            <h1 className="text-[clamp(2rem,5vw,4.75rem)] font-normal leading-[1.08] tracking-[-0.045em] text-dot-primary">
              유약이 빚어낸
              <br />
              온전한 휴식
              <span className="ml-2 whitespace-nowrap">(休)</span>
            </h1>
            <p className="mt-6 font-serif text-[clamp(1.5rem,3vw,3.25rem)] italic leading-tight text-[#A69A8B]">
              Rest, crafted in glaze
            </p>
          </div>
          <div className="reveal-element mt-16 flex flex-col gap-3 border-t border-black/15 pt-5 text-sm text-dot-secondary sm:flex-row sm:items-center sm:justify-between md:mt-24">
            <span>작가 신은지 (Day Off Today)</span>
            <span>Selected Works — 2026</span>
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 px-6 py-20 md:px-12 md:py-28 lg:px-16 lg:py-36">
        <div className="mx-auto grid max-w-[1500px] items-stretch gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 xl:gap-28">
          <figure className="reveal-element min-h-[520px] overflow-hidden bg-[#E5EDF3] lg:min-h-[760px]">
            <img
              src={`${ABOUT_IMAGES}/image11.jpg`}
              alt="Day Off Today 도자기와 손"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </figure>
          <div className="reveal-element flex flex-col justify-center">
            <p className="font-serif text-base italic text-[#A69A8B]">
              Introduction
            </p>
            <h2 className="mt-5 text-4xl font-normal leading-tight tracking-[-0.04em] text-dot-primary md:text-5xl">
              자연의 재료로
              <br />
              휴식을 빚다
            </h2>
            <div className="mt-10 space-y-6 text-base font-light leading-[1.9] text-dot-secondary md:text-[1.05rem]">
              <p>
                도자기 브랜드 ‘Day Off Today’는 일상 속 온전한 쉼을 전합니다.
                브랜드 이름인 ‘휴일’의 의미를 상형문자 ‘휴(休)’로 시각화하여,
                언제든 기대어 쉴 수 있는 나무 같은 기물을 빚습니다.
              </p>
              <p>
                전통적인 모양을 모티브로 슬립캐스팅과 물레 성형으로 형태를
                구현한 뒤, 자연을 닮은 화려하지 않은 색채를 연구해 오래 곁에
                둘수록 평온함을 주는 독창적인 발색을 찾아냅니다.
              </p>
              <p>
                흙과 불, 유약의 조화로 빚어낸 따듯한 위로를 식탁 위에
                올려드립니다.
              </p>
            </div>
            <p className="mt-12 border-t border-black/10 pt-5 text-sm text-[#918474]">
              포트폴리오 수록 작품은 모두 수작업으로 제작되었습니다.
            </p>
          </div>
        </div>
      </section>

      <div>
        <nav
          aria-label="작품 시리즈"
          className="sticky top-[68px] z-20 overflow-x-auto border-y border-black/10 bg-[#F9F8F6]/90 px-6 backdrop-blur-md md:top-[82px] md:px-12 lg:px-16"
        >
          <div className="mx-auto flex w-max min-w-full max-w-[1500px] items-center justify-between gap-10 py-4">
            {SERIES.map((series) => (
              <a
                key={series.number}
                href={`#series-${series.number}`}
                className="mono whitespace-nowrap text-[0.62rem] font-normal text-dot-secondary transition-colors hover:text-dot-primary"
              >
                {series.number} {series.title}
              </a>
            ))}
          </div>
        </nav>

        {SERIES.map((series, index) => (
          <PortfolioSeriesSection
            key={series.number}
            series={series}
            index={index}
          />
        ))}
      </div>

      <section className="portfolio-grid border-t border-black/10 px-6 py-24 text-center md:px-12 md:py-36 lg:px-16">
        <div className="reveal-element mx-auto max-w-[1000px]">
          <div className="mx-auto h-16 w-20 overflow-hidden md:h-20 md:w-24">
            <img
              src="/assets/dot_mark.png"
              alt="휴(休)"
              loading="lazy"
              className="h-full w-full scale-[1.75] object-contain mix-blend-multiply"
            />
          </div>
          <h2 className="mt-10 text-4xl font-normal tracking-[-0.035em] text-dot-primary md:text-6xl">
            식탁 위 휴식을 전하며
          </h2>
          <p className="mx-auto mt-7 max-w-[760px] text-base font-light leading-relaxed text-dot-secondary md:text-lg">
            사물의 쓰임과 내면을 깊이 들여다보는 도예의 여정에 함께해주셔서
            감사합니다.
          </p>
        </div>
      </section>
    </div>
  )
}
