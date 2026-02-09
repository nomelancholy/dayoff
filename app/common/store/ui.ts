import { create } from 'zustand'

interface UiState {
  /** 모바일 네비/사이드바 열림 여부 등 UI 플래그 확장용 */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
