import { SectionImage } from './SectionImage'
import { SectionText } from './SectionText'

const STORY_IMAGE = '/assets/class/pottery_wheel_thumbnail.jpg'

const STORY_CONTENT = {
  title: '당신의 공간에 머무는 고요한 쉼표 하나',
  paragraphs: [
    '<b>DOT(Day Off Today)</b> 의 시작은 2019년, 어느 조용한 카페의 한편이었습니다. 흙을 만지는 즐거움을 나누고 싶어 시작했던 그 작은 공간에서, 우리는 수많은 분의 손길을 마주했습니다. ',
    '누군가에게는 새로운 시작이었고, 누군가에게는 위로의 시간이었을 그 모든 순간을 지나 우리는 이제 더 넓은 휴식을 이야기하려 합니다.',
    '우리가 함께 나눈 그 고요한 평온함을 이제 당신의 식탁 위에, 혹은 서랍장 위에 올려두려 합니다.',
  ],
} as const

export function StorySection() {
  return (
    <section className="px-6 py-24 md:px-12 lg:px-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2 md:gap-24">
          <div className="reveal-element">
            <SectionImage src={STORY_IMAGE} alt="Potter working" />
          </div>
          <div className="reveal-element">
            <SectionText
              title={STORY_CONTENT.title}
              paragraphs={[...STORY_CONTENT.paragraphs]}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
