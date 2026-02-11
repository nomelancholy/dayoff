import { create } from 'zustand'

export interface ToastOptions {
  message: string
  actionLabel?: string
  actionHref?: string
}

interface UiState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  /** 토스트: message 필수, actionLabel/actionHref 있으면 링크 버튼 표시 */
  toast: ToastOptions | null
  showToast: (options: ToastOptions) => void
  hideToast: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toast: null,
  showToast: (options) => set({ toast: options }),
  hideToast: () => set({ toast: null }),
}))
