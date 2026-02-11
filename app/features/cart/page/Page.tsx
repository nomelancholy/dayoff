import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { fetchCartItems, updateCartItemQuantity, removeCartItem } from '@/features/shop/api/shop'
import { getStoredToken } from '@/features/auth/api/auth'
import { Minus, Plus } from 'lucide-react'

export const CartPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = getStoredToken()

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['shop', 'cart'],
    queryFn: fetchCartItems,
    enabled: !!token,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      updateCartItemQuantity(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'cart'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeCartItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'cart'] })
    },
  })

  if (!token) {
    return (
      <div className="min-h-screen bg-dot-bg px-6 py-48 text-center md:px-16">
        <span className="mono text-dot-primary">YOUR SELECTION</span>
        <h1 className="mt-2 font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
          Shopping Cart
        </h1>
        <p className="mt-8 text-[0.9rem] text-dot-secondary">Please login to view your cart.</p>
        <Link
          to="/login"
          className="mt-10 inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
        >
          Login
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
        <div className="mx-auto max-w-[1200px] animate-pulse">
          <div className="mb-8 border-b border-[#eee] pb-4">
            <div className="h-4 w-24 bg-[#eee]" />
            <div className="mt-2 h-10 w-48 bg-[#eee]" />
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-8">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-8 border-b border-[#eee] pb-8">
                  <div className="h-[120px] w-[120px] shrink-0 bg-[#eee]" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-1/3 bg-[#eee]" />
                    <div className="h-4 w-1/4 bg-[#eee]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-64 bg-[#f5f5f5]" />
          </div>
        </div>
      </div>
    )
  }

  const subtotal = items?.reduce((sum, item) => sum + item.product.price * item.quantity, 0) || 0
  const shipping = subtotal >= 100000 ? 0 : 3000
  const total = subtotal + shipping

  return (
    <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 lg:grid-cols-[1.5fr_1fr]">
        <header className="col-span-full mb-8 border-b border-[#eee] pb-4">
          <span className="mono block text-dot-primary">YOUR SELECTION</span>
          <h1 className="mt-2 font-serif text-[2.5rem] font-normal tracking-[0.12em] text-dot-primary">
            Shopping Cart
          </h1>
        </header>

        {!items || items.length === 0 ? (
          <div className="col-span-full py-24 text-center">
            <h2 className="font-serif text-2xl font-normal tracking-[0.12em] text-dot-primary">
              Your cart is currently empty.
            </h2>
            <p className="mt-4 mb-12 text-[0.95rem] text-dot-secondary">
              Discover our handcrafted collections and find something special.
            </p>
            <Link
              to="/shop"
              className="mono inline-block border border-dot-primary px-8 py-4 text-dot-primary no-underline transition-colors hover:bg-dot-primary hover:text-white"
            >
              CONTINUE SHOPPING
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-8">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[120px_1fr_auto] gap-8 border-b border-[#eee] pb-8 md:items-center"
                >
                  <Link
                    to={`/shop/${item.productId}`}
                    className="block h-[120px] w-[120px] shrink-0 overflow-hidden rounded-sm bg-[#F2F2F2]"
                  >
                    <img
                      src={item.product.images?.[0]?.url}
                      alt={item.product.name}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div>
                    {item.product.category && (
                      <span className="mono mb-1 block text-[0.6rem] text-dot-accent">
                        {item.product.category.name}
                      </span>
                    )}
                    <h3 className="font-serif text-[1.1rem] font-normal tracking-[0.05em] text-dot-primary">
                      {item.product.name}
                    </h3>
                    {item.option && (
                      <p className="mt-1 text-[0.9rem] text-dot-secondary">
                        {item.option.name}: {item.option.value}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-4 rounded border border-[#eee] bg-white px-3 py-1.5 w-fit">
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: item.id,
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        className="flex items-center justify-center text-dot-primary hover:opacity-70"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-[0.9rem]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({ id: item.id, quantity: item.quantity + 1 })
                        }
                        className="flex items-center justify-center text-dot-primary hover:opacity-70"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between gap-4">
                    <span className="text-[1.1rem] font-medium text-dot-primary">
                      ₩{(item.product.price * item.quantity).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(item.id)}
                      className="mono text-[0.8rem] text-dot-secondary underline transition-colors hover:text-dot-primary"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit bg-white p-8 lg:sticky lg:top-28">
              <h2 className="mono mb-8 border-b border-[#eee] pb-4 text-[1.5rem] font-normal tracking-[0.12em] text-dot-primary">
                ORDER SUMMARY
              </h2>
              <div className="space-y-4 text-[0.95rem]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₩{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : `₩${shipping.toLocaleString()}`}</span>
                </div>
              </div>
              <div className="mt-8 flex justify-between border-t border-[#eee] pt-6 text-[1.2rem] font-medium">
                <span>Total</span>
                <span>₩{total.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => alert('주문 기능은 준비 중입니다.')}
                className="mono mt-10 block w-full bg-dot-primary py-4 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#333]"
              >
                PROCEED TO CHECKOUT
              </button>
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
