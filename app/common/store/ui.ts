import { create } from 'zustand'

export interface ToastOptions {
  message: string
  actionLabel?: string
  actionHref?: string
  variant?: 'default' | 'success' | 'warning'
  /** 클릭 좌표 기준으로 토스트를 가까운 위치에 표시(클라이언트 픽셀 좌표) */
  anchor?: { x: number; y: number }
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
