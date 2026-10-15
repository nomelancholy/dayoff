import apiClient from '@/common/lib/apiClient'

export async function submitContactInquiry(
  data: FormData
): Promise<{ success: true }> {
  const response = await apiClient.post<{ success: boolean }>(
    '/api/contact/inquiries',
    data,
    {
      headers: { 'Content-Type': undefined },
      timeout: 20_000,
    }
  )
  if (response.success !== true)
    throw new Error('문의 전송에 실패했습니다. 다시 시도해 주세요.')
  return { success: true }
}
