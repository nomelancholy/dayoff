import { cn } from '@/common/lib/utils'

export type AdminSectionKey = 'products' | 'users' | 'coupons' | 'orders' | 'reviews'

const NAV_ITEMS: Array<{ key: AdminSectionKey; label: string }> = [
  { key: 'products', label: 'PRODUCTS' },
  { key: 'users', label: 'USERS' },
  { key: 'coupons', label: 'COUPONS' },
  { key: 'orders', label: 'ORDERS' },
  { key: 'reviews', label: 'REVIEWS' },
]

export const AdminSidebar = ({
  activeKey,
  onSelect,
}: {
  activeKey: AdminSectionKey
  onSelect: (key: AdminSectionKey) => void
}) => {
  return (
    <aside className="rounded border border-[#eee] bg-white p-4">
      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={cn(
              'rounded px-3 py-2 text-left text-[0.9rem] font-medium transition-colors',
              item.key === activeKey
                ? 'bg-dot-primary text-white'
                : 'bg-transparent text-dot-secondary hover:bg-[#f7f7f7] hover:text-dot-primary'
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

