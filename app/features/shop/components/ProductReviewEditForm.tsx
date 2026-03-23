import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateAdminReview, updateMyReview } from '../api/shop'
import { cn } from '@/common/lib/utils'
import { useUiStore } from '@/common/store/ui'

const REVIEW_BODY_MAX = 5000
const REVIEW_BODY_MIN = 10

export interface ProductReviewEditFormProps {
  reviewId: string
  mode: 'my' | 'admin'
  initialBody: string
  initialRating: number | null
  onSuccess: () => void
  onCancel?: () => void
}

export const ProductReviewEditForm = ({
  reviewId,
  mode,
  initialBody,
  initialRating,
  onSuccess,
  onCancel,
}: ProductReviewEditFormProps) => {
  const [body, setBody] = useState(initialBody)
  const [rating, setRating] = useState<number | null>(initialRating)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useUiStore((s) => s.showToast)

  const reviewMutation = useMutation({
    mutationFn: async (data: { body: string; rating: number | null }) => {
      const payload = { body: data.body, rating: data.rating ?? undefined }
      if (mode === 'my') {
        await updateMyReview(reviewId, payload)
      } else {
        await updateAdminReview(reviewId, payload)
      }
      return null
    },
    onSuccess: () => {
      onSuccess()
    },
    onError: (err: unknown) => {
      setIsSubmitting(false)
      alert(
        err instanceof Error
          ? err.message
          : '구매평 수정에 실패했습니다.',
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < REVIEW_BODY_MIN) {
      showToast({
        variant: 'warning',
        message: `구매평은 최소 ${REVIEW_BODY_MIN}자 이상 작성해 주세요.`,
      })
      return
    }
    if (trimmed.length > REVIEW_BODY_MAX) {
      alert(`내용은 ${REVIEW_BODY_MAX}자 이하로 입력해 주세요.`)
      return
    }

    setIsSubmitting(true)
    reviewMutation.mutate(
      { body: trimmed, rating },
      {
        onSettled: () => setIsSubmitting(false),
      },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-[#eee] bg-[#fafafa] p-6"
    >
      <div className="mb-4 flex items-center justify-between border-b border-[#eee] pb-4">
        <h4 className="font-serif text-[1.2rem] font-normal tracking-wide text-dot-primary">
          구매평 수정
        </h4>
      </div>

      <div className="mb-6">
        <label className="mono mb-3 block text-[0.75rem] font-medium tracking-widest text-dot-primary">
          만족도
        </label>
        <div className="flex gap-1.5" role="group" aria-label="별점 선택">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="text-2xl leading-none text-amber-400 transition-transform hover:scale-110 focus:outline-none"
              aria-label={`${star}점`}
              aria-pressed={rating === star}
            >
              {rating != null && star <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="mono mb-3 block text-[0.75rem] font-medium tracking-widest text-dot-primary">
          구매평 내용
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))}
          rows={5}
          placeholder="리뷰 내용을 수정해 주세요."
          className="w-full border border-[#eee] bg-white px-4 py-3 text-[0.95rem] italic text-dot-primary focus:border-dot-primary focus:outline-none"
          required
          maxLength={REVIEW_BODY_MAX}
        />
        <p
          className={cn(
            'mt-2 text-[0.72rem]',
            body.trim().length >= REVIEW_BODY_MIN
              ? 'text-[#5f5a50]'
              : 'text-amber-700',
          )}
        >
          최소 {REVIEW_BODY_MIN}자 이상 작성해 주세요.
        </p>
      </div>

      <div className="flex gap-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mono flex-1 border border-[#ddd] bg-white py-3 text-[0.8rem] font-medium tracking-widest text-dot-primary transition-colors hover:bg-[#f9f9f9]"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || reviewMutation.isPending}
          className={cn(
            'mono flex-1 py-3 text-[0.8rem] font-medium tracking-widest text-white transition-opacity disabled:opacity-50',
            'bg-[#1A1A1A] hover:bg-[#333]',
          )}
        >
          {isSubmitting || reviewMutation.isPending ? '수정 중…' : '수정 완료'}
        </button>
      </div>
    </form>
  )
}

