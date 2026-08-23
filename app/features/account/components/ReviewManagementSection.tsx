import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchMyReviews,
  deleteMyReview,
  type MyReviewItem,
} from '@/features/shop/api/shop'
import { ProductReviewEditForm } from '@/features/shop/components/ProductReviewEditForm'

export const ReviewManagementSection = () => {
  const queryClient = useQueryClient()
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['shop', 'my-reviews'],
    queryFn: fetchMyReviews,
  })

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)

  const editingReview = useMemo(
    () => reviews.find((r) => r.id === editingReviewId) ?? null,
    [reviews, editingReviewId]
  )

  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => deleteMyReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'my-reviews'] })
      if (editingReviewId) setEditingReviewId(null)
      alert('리뷰가 삭제되었습니다.')
    },
    onError: (err: unknown) => {
      alert(err instanceof Error ? err.message : '리뷰 삭제에 실패했습니다.')
    },
  })

  return (
    <section className="space-y-6">
      <div>
        <h2 className="mono text-[1.9rem] font-normal tracking-[0.12em] text-dot-primary">
          리뷰 관리
        </h2>
        <p className="mt-2 text-dot-secondary text-sm">
          내가 작성한 구매평을 수정하거나 삭제할 수 있습니다.
        </p>
      </div>

      {isLoading ? (
        <div className="text-dot-secondary">Loading…</div>
      ) : reviews.length === 0 ? (
        <div className="text-dot-secondary">작성한 리뷰가 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: MyReviewItem) => (
            <div
              key={r.id}
              className="rounded border border-[#eee] bg-white p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-medium text-dot-primary">
                    <Link
                      to={`/shop/${r.product.slug}`}
                      className="hover:underline"
                    >
                      {r.product.name}
                    </Link>
                  </div>
                  <div className="mt-1 text-sm text-dot-secondary">
                    {new Date(r.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingReviewId(r.id)}
                    className="rounded border border-dot-primary bg-white px-3 py-2 text-[0.85rem] font-medium text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
                    disabled={deleteMutation.isPending}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('이 리뷰를 삭제할까요?')) return
                      deleteMutation.mutate(r.id)
                    }}
                    disabled={deleteMutation.isPending}
                    className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.85rem] font-medium text-[#1A1A1A] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} aria-hidden="true">
                    {r.rating != null && i <= r.rating ? '★' : '☆'}
                  </span>
                ))}
              </div>

              <p className="mt-3 whitespace-pre-line text-[0.98rem] leading-relaxed text-dot-primary">
                {r.body}
              </p>

              {r.images?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.images.map((img) => (
                    <img
                      key={img.id}
                      src={img.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-20 w-20 rounded-sm border border-[#eee] object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editingReview ? (
        <div
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <ProductReviewEditForm
              reviewId={editingReview.id}
              mode="my"
              initialBody={editingReview.body}
              initialRating={editingReview.rating}
              onCancel={() => setEditingReviewId(null)}
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: ['shop', 'my-reviews'],
                })
                setEditingReviewId(null)
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
