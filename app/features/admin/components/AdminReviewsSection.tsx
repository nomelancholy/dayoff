import { useMemo, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchAdminReviews, deleteAdminReview, type AdminReviewItem } from '@/features/shop/api/shop'
import { ProductReviewEditForm } from '@/features/shop/components/ProductReviewEditForm'

export const AdminReviewsSection = () => {
  const queryClient = useQueryClient()
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['shop', 'admin', 'reviews'],
    queryFn: fetchAdminReviews,
  })

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)

  const editingReview = useMemo(
    () => reviews.find((r) => r.id === editingReviewId) ?? null,
    [reviews, editingReviewId],
  )

  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => deleteAdminReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'admin', 'reviews'] })
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
        <h2 className="font-serif text-2xl tracking-[0.08em] text-dot-primary">
          REVIEWS
        </h2>
        <p className="mt-2 text-dot-secondary text-sm">
          사용자 리뷰를 수정/삭제할 수 있습니다.
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-[#eee] bg-white">
        {isLoading ? (
          <div className="p-6 text-dot-secondary">Loading…</div>
        ) : reviews.length === 0 ? (
          <div className="p-6 text-dot-secondary">리뷰가 없습니다.</div>
        ) : (
          <table className="min-w-[1200px] table-fixed border-collapse">
            <thead>
              <tr className="border-b border-[#eee] text-left text-[0.85rem] text-dot-secondary">
                <th className="px-4 py-3 w-[220px]">상품</th>
                <th className="px-4 py-3 w-[220px]">작성자</th>
                <th className="px-4 py-3 w-[130px]">별점</th>
                <th className="px-4 py-3">내용</th>
                <th className="px-4 py-3 w-[170px]">작성일</th>
                <th className="px-4 py-3 w-[160px]">작업</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r: AdminReviewItem) => (
                <tr key={r.id} className="border-b border-[#f3f3f3]">
                  <td className="px-4 py-4 text-dot-primary align-top">
                    <Link
                      to={`/shop/${r.product.slug}`}
                      className="font-medium truncate hover:underline"
                    >
                      {r.product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-dot-secondary align-top">
                    <div className="truncate">
                      {r.user.fullName || r.user.email}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className="text-[1rem] text-amber-500"
                          aria-hidden="true"
                        >
                          {r.rating != null && i <= r.rating ? '★' : '☆'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="line-clamp-3 wrap-break-word">
                      {r.body}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-dot-secondary align-top">
                    {new Date(r.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingReviewId(r.id)}
                        className="rounded border border-dot-primary bg-white px-3 py-2 text-[0.8rem] font-medium text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
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
                        className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.8rem] font-medium text-[#1A1A1A] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingReview ? (
        <div
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <ProductReviewEditForm
              reviewId={editingReview.id}
              mode="admin"
              initialBody={editingReview.body}
              initialRating={editingReview.rating}
              onCancel={() => setEditingReviewId(null)}
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: ['shop', 'admin', 'reviews'],
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

