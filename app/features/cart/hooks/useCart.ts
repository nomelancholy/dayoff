import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStoredToken } from '@/features/auth/api/auth'
import { fetchCartItems } from '@/features/shop/api/shop'
import {
  GUEST_CART_EVENT,
  GUEST_CART_KEY,
  guestCartSnapshot,
} from '../lib/guestCart'

let previousToken: string | null | undefined
let session = 0
function snapshot() {
  const token = getStoredToken()
  if (token !== previousToken) {
    previousToken = token
    session += 1
  }
  // Never put the JWT itself in the query cache. Guest changes invalidate in-flight snapshots.
  return `${session}:${token ? 'member' : guestCartSnapshot()}`
}
function subscribe(notify: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === 'auth_token' ||
      event.key === GUEST_CART_KEY
    )
      notify()
  }
  window.addEventListener('auth-session-changed', notify)
  window.addEventListener(GUEST_CART_EVENT, notify)
  window.addEventListener('storage', storageChanged)
  return () => {
    window.removeEventListener('auth-session-changed', notify)
    window.removeEventListener(GUEST_CART_EVENT, notify)
    window.removeEventListener('storage', storageChanged)
  }
}
export function useCart() {
  const identity = useSyncExternalStore(subscribe, snapshot, () => 'server')
  return useQuery({
    queryKey: ['shop', 'cart', identity],
    queryFn: fetchCartItems,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}
