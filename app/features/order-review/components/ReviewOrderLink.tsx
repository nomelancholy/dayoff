import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveReviewDraft, type ReviewDraft } from '../api/review'
export function ReviewOrderLink({
  items,
  source,
  disabled,
  validate,
}: ReviewDraft & { disabled?: boolean; validate?: () => string | null }) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="w-full">
      <button
        type="button"
        disabled={disabled}
        className="w-full border border-dot-primary bg-dot-primary px-5 py-4 text-sm text-white disabled:opacity-40"
        onClick={() => {
          const issue = validate?.()
          if (issue) {
            setError(issue)
            return
          }
          try {
            saveReviewDraft({ items, source })
            navigate('/order-review')
          } catch {
            setError(
              '주문 정보를 저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.'
            )
          }
        }}
      >
        주문 확인 및 쿠폰 적용
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
