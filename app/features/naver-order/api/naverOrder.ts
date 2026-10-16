import apiClient from '@/common/lib/apiClient'

export type NaverOrderConfig =
  | { enabled: false }
  | {
      enabled: true
      buttonKey: string
      accountId: string
      origin: string
      sdkUrl: string
      orderHistoryUrl: string
    }
export type NaverOrderItem = {
  productId: string
  optionId?: string | null
  quantity: number
}
export const fetchNaverOrderConfig = () =>
  apiClient.get<NaverOrderConfig>('/shop/naver-order/config')
function cookie(name: string) {
  const value =
    document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ''
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}
export const registerNaverOrder = (items: NaverOrderItem[]) =>
  apiClient.post<{ key: string; merchantNo: string }>(
    '/shop/naver-order/register',
    {
      items,
      source: window.location.pathname === '/cart' ? 'cart' : 'product',
      naverInflowCode: cookie('NA_CO'),
      cpaInflowCode: cookie('CPAValidator'),
      saClickId: cookie('NVADID'),
    }
  )

export interface NpayButton {
  dispose(): void
}
declare global {
  interface Window {
    Npay?: {
      order: {
        create(options: {
          buttonKey: string
          containerId: string
          orderRegistrationVersion: '2.1'
          type: 'template'
          colorTheme: 'green'
          enable: boolean
          components: { benefitMessage: boolean }
          onBuyClick(): Promise<{ key: string; merchantNo: string }>
        }): Promise<NpayButton>
      }
    }
    wcs_add?: { wa: string }
    wcs?: { checkoutWhitelist: string[]; inflow(domain: string): void }
    wcs_do?: () => void
  }
}
const scripts = new Map<string, Promise<void>>()
export function loadNaverScript(src: string) {
  const existing = scripts.get(src)
  if (existing) return existing
  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    const timeout = window.setTimeout(() => fail(), 15000)
    const fail = () => {
      window.clearTimeout(timeout)
      script.remove()
      scripts.delete(src)
      reject(
        new Error(
          '네이버페이를 불러오지 못했습니다. 페이지를 새로고침해 주세요.'
        )
      )
    }
    script.onload = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  scripts.set(src, pending)
  return pending
}
export async function prepareNaverTracking(
  config: Extract<NaverOrderConfig, { enabled: true }>
) {
  await loadNaverScript('https://wcs.naver.net/wcslog.js')
  if (!window.wcs) throw new Error('네이버페이를 불러오지 못했습니다.')
  window.wcs_add = { wa: config.accountId }
  const domain = new URL(config.origin).hostname.replace(/^www\./, '')
  window.wcs.checkoutWhitelist = [domain]
  window.wcs.inflow(domain)
}
