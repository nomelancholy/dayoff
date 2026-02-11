import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createProductReview, uploadReviewImages } from '../api/shop'
import { cn } from '@/common/lib/utils'
import { Camera } from 'lucide-react'

const REVIEW_BODY_MAX = 5000
const REVIEW_BODY_MIN = 10

export interface ProductReviewFormProps {
  productId: string
  productName?: string
  onSuccess: () => void
  onCancel?: () => void
}

/** 구매평 작성 폼 (Order History 등에서 사용) */
export const ProductReviewForm = ({
  productId,
  productName,
  onSuccess,
  onCancel,
}: ProductReviewFormProps) => {
  const [body, setBody] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reviewMutation = useMutation({
    mutationFn: (data: { body: string; rating?: number; imageUrls?: string[] }) =>
      createProductReview(productId, data),
    onSuccess: () => {
      setBody('')
      setRating(null)
      setFiles([])
      onSuccess()
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      setIsSubmitting(false)
      alert(err.response?.data?.message || err.message || '구매평 작성에 실패했습니다.')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < REVIEW_BODY_MIN) {
      alert(`내용은 최소 ${REVIEW_BODY_MIN}자 이상 입력해 주세요.`)
      return
    }
    if (trimmed.length > REVIEW_BODY_MAX) {
      alert(`내용은 ${REVIEW_BODY_MAX}자 이하로 입력해 주세요.`)
      return
    }
    setIsSubmitting(true)
    try {
      let imageUrls: string[] | undefined
      if (files.length > 0) {
        const { urls } = await uploadReviewImages(files)
        imageUrls = urls.length > 0 ? urls : undefined
      }
      reviewMutation.mutate(
        { body: trimmed, rating: rating ?? undefined, imageUrls },
        { onSettled: () => setIsSubmitting(false) }
      )
    } catch (err: unknown) {
      setIsSubmitting(false)
      alert(err instanceof Error ? err.message : '이미지 업로드 또는 구매평 등록에 실패했습니다.')
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : []
    setFiles((prev) => [...prev, ...selected].slice(0, 10))
    e.target.value = ''
  }
  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index))

  return (
    <form onSubmit={handleSubmit} className="rounded-sm border border-[#eee] bg-[#fafafa] p-6">
      <div className="mb-8 flex items-center justify-between border-b border-[#eee] pb-4">
        <h4 className="font-serif text-[1.3rem] font-normal tracking-wide text-dot-primary">
          Write a Review
        </h4>
        {productName && (
          <span className="mono text-[0.7rem] text-dot-secondary">
            PRODUCT: {productName.toUpperCase()}
          </span>
        )}
      </div>

      <div className="mb-8">
        <label className="mono mb-3 block text-[0.75rem] font-medium tracking-widest text-dot-primary">
          SATISFACTION
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
        <p className="mt-2 text-[0.7rem] text-dot-secondary">How would you rate this product?</p>
      </div>

      <div className="mb-8">
        <label className="mono mb-3 block text-[0.75rem] font-medium tracking-widest text-dot-primary">
          YOUR THOUGHTS
        </label>
        <div className="relative">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))}
            rows={5}
            placeholder="Share your experience with this product. (Min. 10 characters)"
            className="w-full border border-[#eee] bg-white px-4 py-3 text-[0.95rem] italic text-dot-primary focus:border-dot-primary focus:outline-none"
            required
            minLength={REVIEW_BODY_MIN}
            maxLength={REVIEW_BODY_MAX}
          />
          <span className="absolute bottom-2 right-3 mono text-[0.6rem] text-[#999]">
            {body.length}/{REVIEW_BODY_MAX}
          </span>
        </div>
      </div>

      <div className="mb-10">
        <label className="mono mb-3 block text-[0.75rem] font-medium tracking-widest text-dot-primary">
          ATTACH PHOTOS
        </label>
        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="sr-only"
            onChange={onFileChange}
          />
          <div className="flex flex-col items-center justify-center border border-dashed border-[#ddd] bg-white py-8 transition-colors hover:bg-[#fcfcfc]">
            <Camera className="mb-2 h-6 w-6 text-[#999]" strokeWidth={1} />
            <span className="mono text-[0.7rem] text-dot-primary">UPLOAD IMAGES</span>
            <span className="mt-1 text-[0.6rem] text-[#888]">MAX 10 PHOTOS (JPG, PNG, WEBP)</span>
          </div>
        </label>
        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {files.map((file, i) => (
              <div key={i} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="h-20 w-20 rounded-sm border border-[#eee] object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-[10px] text-white"
                  aria-label="삭제"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mono flex-1 border border-[#ddd] bg-white py-3 text-[0.8rem] font-medium tracking-widest text-dot-primary transition-colors hover:bg-[#f9f9f9]"
          >
            CANCEL
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || reviewMutation.isPending}
          className={cn(
            'mono flex-1 py-3 text-[0.8rem] font-medium tracking-widest text-white transition-opacity disabled:opacity-50',
            'bg-[#1A1A1A] hover:bg-[#333]'
          )}
        >
          {isSubmitting || reviewMutation.isPending ? 'SUBMITTING...' : 'SUBMIT REVIEW'}
        </button>
      </div>
    </form>
  )
}
