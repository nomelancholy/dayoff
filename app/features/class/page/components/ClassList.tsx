import { CLASS_ITEMS } from '../classData'
import { ClassItem } from './ClassItem'

export function ClassList() {
  return (
    <main className="mx-auto max-w-[1400px] px-6 py-12 md:px-16 md:py-32">
      {CLASS_ITEMS.map((item, index) => (
        <ClassItem key={item.id} data={item} reverse={index % 2 === 1} />
      ))}
    </main>
  )
}
