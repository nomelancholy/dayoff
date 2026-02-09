import { Link, useParams } from 'react-router-dom'

const PREVIEW_PRODUCTS: Record<string, { name: string; price: number; image: string; alt: string }> = {
  '1': {
    name: 'MOONLIGHT VASE',
    price: 82000,
    image:
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=800',
    alt: 'Ceramic Vase',
  },
  '2': {
    name: 'EARTHEN TEA SET',
    price: 124000,
    image:
      'https://images.unsplash.com/photo-1578507065211-1c4e99a5fd24?auto=format&fit=crop&q=80&w=800',
    alt: 'Tea Set',
  },
  '3': {
    name: 'PALE MIST PLATE',
    price: 45000,
    image:
      'https://images.unsplash.com/photo-1449444004900-5895743c3917?auto=format&fit=crop&q=80&w=800',
    alt: 'Hand-built Plate',
  },
}

export const ShopProductPage = () => {
  const { id } = useParams<{ id: string }>()
  const product = id ? PREVIEW_PRODUCTS[id] : null

  if (!product) {
    return (
      <div className="min-h-screen bg-dot-bg px-6 py-32 md:px-16">
        <p className="text-dot-secondary">상품을 찾을 수 없습니다.</p>
        <Link to="/shop" className="mono mt-4 inline-block text-dot-primary underline">
          SHOP으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dot-bg px-6 py-28 md:px-16 md:py-36">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-2">
        <div className="aspect-square overflow-hidden bg-[#F2F2F2]">
          <img
            src={product.image}
            alt={product.alt}
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <span className="mono text-dot-primary">COLLECTIONS</span>
          <h1 className="mt-2 font-serif text-3xl font-normal tracking-[0.12em] text-dot-primary md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-6 text-xl text-dot-secondary">
            ₩{product.price.toLocaleString()}
          </p>
          <p className="mt-8 text-dot-secondary">
            상품 상세 설명 (구현 예정)
          </p>
          <div className="mt-10 flex gap-4">
            <Link
              to="/cart"
              className="inline-flex items-center justify-center bg-dot-primary px-8 py-3 font-medium text-dot-bg transition-[var(--dot-transition)] hover:opacity-90"
            >
              장바구니에 담기
            </Link>
            <Link
              to="/shop"
              className="mono inline-block py-3 text-dot-primary underline underline-offset-2"
            >
              SHOP 목록
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
