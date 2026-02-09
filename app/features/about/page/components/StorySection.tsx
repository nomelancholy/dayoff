import { SectionImage } from './SectionImage'
import { SectionText } from './SectionText'

const STORY_IMAGE =
  'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?auto=format&fit=crop&q=80&w=1000'

const STORY_CONTENT = {
  label: 'SINCE 2018',
  title: '진심을 빚는 시간,<br>공방 DOT.의 이야기',
  paragraphs: [
    '공방 DOT.는 바쁜 현대인의 일상 속에 작은 쉼표를 찍고자 시작되었습니다. 우리는 흙이라는 가장 정직한 재료를 통해, 인위적이지 않은 자연스러운 아름다움을 탐구합니다.',
    '모든 기물은 작가의 손길을 거쳐 하나하나 다르게 태어납니다. 미세한 질감의 차이, 가마 속 불의 흐름이 만들어낸 우연한 무늬는 오직 그 기물만이 가진 고유한 서사가 됩니다.',
    '우리는 단순히 물건을 판매하는 것을 넘어, 그 물건이 놓인 공간의 분위기와 그를 사용하는 사람의 마음까지 따스하게 채울 수 있기를 바랍니다.',
  ],
} as const

export function StorySection() {
  return (
    <section className="px-6 py-24 md:px-12 lg:px-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-1 items-start gap-16 md:grid-cols-2 md:gap-24">
          <div className="reveal-element">
            <SectionImage src={STORY_IMAGE} alt="Potter working" />
          </div>
          <div className="reveal-element">
            <SectionText
              label={STORY_CONTENT.label}
              title={STORY_CONTENT.title}
              paragraphs={[...STORY_CONTENT.paragraphs]}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
