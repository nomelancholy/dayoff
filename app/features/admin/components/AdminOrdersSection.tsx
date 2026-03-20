import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import {
  fetchAdminOrders,
  updateAdminOrderShipment,
  deleteAdminPendingOrders,
  type AdminOrderRow,
} from '../api/adminOrders'
import { cn } from '@/common/lib/utils'

export const AdminOrdersSection = () => {
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  >('all')
  const effectiveStatus = statusFilter === 'all' ? undefined : statusFilter

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin', 'orders', statusFilter],
    queryFn: () => fetchAdminOrders(effectiveStatus),
    staleTime: 15_000,
  })

  const deletePendingMutation = useMutation({
    mutationFn: () => deleteAdminPendingOrders(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'orders', 'pending'],
      })
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, 'pending 주문 삭제에 실패했습니다.'))
    },
  })

  const shipmentMutation = useMutation({
    mutationFn: (params: { orderId: string; trackingNumber: string }) =>
      updateAdminOrderShipment(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      setShipmentModalOrderId(null)
      setShipmentModalValue('')
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, '발송 처리에 실패했습니다.'))
    },
  })

  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>(
    {}
  )

  const [shipmentModalOrderId, setShipmentModalOrderId] = useState<
    string | null
  >(null)
  const [shipmentModalValue, setShipmentModalValue] = useState('')

  const closeShipmentModal = () => {
    setShipmentModalOrderId(null)
    setShipmentModalValue('')
  }

  const openShipmentModal = (orderId: string) => {
    setShipmentModalOrderId(orderId)
    setShipmentModalValue(trackingDrafts[orderId] ?? '')
  }

  const statusLabel = useMemo(() => {
    return {
      pending: '결제 대기',
      paid: '결제 완료',
      shipped: '발송 완료',
      delivered: '배송 완료',
      cancelled: '취소됨',
    } as const
  }, [])

  return (
    <section className="py-2">
      <h2 className="mono mb-6 text-[1.4rem] font-normal tracking-[0.12em] text-dot-primary">
        주문 관리
      </h2>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-dot-secondary">상태 필터</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="w-[180px] rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
          >
            <option value="all">전체</option>
            <option value="pending">결제 대기</option>
            <option value="paid">결제 완료</option>
            <option value="shipped">발송 완료</option>
            <option value="delivered">배송 완료</option>
            <option value="cancelled">취소됨</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            if (!window.confirm('결제 대기(pending) 주문을 전부 삭제할까요?'))
              return
            deletePendingMutation.mutate()
          }}
          disabled={deletePendingMutation.isPending}
          className="mono rounded border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7] disabled:opacity-40"
        >
          {deletePendingMutation.isPending ? '삭제 중…' : 'pending 삭제'}
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-[#eee] bg-white">
        {isLoading ? (
          <div className="p-6 text-dot-secondary">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-dot-secondary">주문이 없습니다.</div>
        ) : (
          <table className="min-w-[1200px] table-fixed border-collapse">
            <thead>
              <tr className="border-b border-[#eee] text-left text-[0.85rem] text-dot-secondary">
                <th className="px-4 py-3 w-[220px]">주문 번호</th>
                <th className="px-4 py-3">주문상품</th>
                <th className="px-4 py-3 min-w-[100px]">상태</th>
                <th className="px-4 py-3">총액</th>
                <th className="px-4 py-3 w-[160px]">받는 사람</th>
                <th className="px-4 py-3 w-[180px]">연락처</th>
                <th className="px-4 py-3 w-[360px]">주소</th>
                <th className="px-4 py-3">발송 처리</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  statusLabel={statusLabel}
                  onOpenShipment={(orderId) => openShipmentModal(orderId)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {shipmentModalOrderId ? (
        <div
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="font-serif text-[1.35rem] text-dot-primary">
              송장번호 입력
            </h3>
            <p className="mt-2 text-[0.95rem] text-dot-secondary">
              숫자/문자를 입력한 뒤 확인을 눌러주세요.
            </p>

            <div className="mt-6">
              <label className="mono mb-1 block text-[0.8rem] text-dot-primary">
                송장번호
              </label>
              <input
                value={shipmentModalValue}
                onChange={(e) => {
                  const next = e.target.value
                  setShipmentModalValue(next)
                  setTrackingDrafts((prev) => ({
                    ...prev,
                    [shipmentModalOrderId]: next,
                  }))
                }}
                placeholder="송장번호"
                className="w-full rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeShipmentModal}
                className="mono flex-1 border border-[#ddd] bg-white py-2.5 text-[0.85rem] text-[#1A1A1A] hover:bg-[#fafafa]"
                disabled={shipmentMutation.isPending}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = shipmentModalValue.trim()
                  if (!val) {
                    alert('송장번호를 입력해 주세요.')
                    return
                  }
                  shipmentMutation.mutate({
                    orderId: shipmentModalOrderId,
                    trackingNumber: val,
                  })
                }}
                disabled={shipmentMutation.isPending}
                className="mono flex-1 border-none bg-[#1A1A1A] py-2.5 text-[0.85rem] font-medium text-white disabled:opacity-50"
              >
                {shipmentMutation.isPending ? '처리 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function OrderRow({
  order,
  statusLabel,
  onOpenShipment,
}: {
  order: AdminOrderRow
  statusLabel: Record<string, string>
  onOpenShipment: (orderId: string) => void
}) {
  const isPaid = order.status === 'paid'
  const isShipped = order.status === 'shipped'
  const addr = order.shippingAddress ?? null
  const orderProducts = order.orderItems
    .map((oi) => {
      const qtyLabel = oi.quantity > 1 ? ` x${oi.quantity}` : ''
      return `${oi.productName}${qtyLabel}`
    })
    .join(', ')

  return (
    <tr className="border-b border-[#f3f3f3]">
      <td className="px-4 py-3 font-medium text-dot-primary w-[220px] whitespace-nowrap overflow-visible">
        {order.orderNumber}
      </td>
      <td className="px-4 py-3 text-dot-secondary whitespace-nowrap">
        {orderProducts}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'rounded border px-2 py-0.5 text-[0.78rem]',
            order.status === 'paid' && 'border-[#ddd] text-dot-primary',
            order.status === 'shipped' && 'border-[#B45309] text-[#B45309]',
            order.status === 'delivered' && 'border-[#ddd] text-dot-primary',
            order.status === 'cancelled' && 'border-red-200 text-red-600'
          )}
        >
          {statusLabel[order.status] ?? order.status}
        </span>
      </td>
      <td className="px-4 py-3 text-dot-secondary">
        ₩{order.total.toLocaleString('ko-KR')}
      </td>
      <td className="px-4 py-3 text-dot-secondary w-[160px] max-w-[160px] overflow-hidden truncate whitespace-nowrap">
        {addr?.recipientName ?? '—'}
      </td>
      <td className="px-4 py-3 text-dot-secondary w-[180px] max-w-[180px] overflow-hidden truncate whitespace-nowrap">
        {addr?.phone ?? '—'}
      </td>
      <td className="px-4 py-3 text-dot-secondary w-[360px] max-w-[360px] wrap-break-word">
        {addr
          ? `${addr.postalCode ?? ''} ${addr.addressLine1}${
              addr.addressLine2 ? ` ${addr.addressLine2}` : ''
            }`.trim()
          : '—'}
      </td>
      <td className="px-4 py-3">
        {isPaid ? (
          <button
            type="button"
            onClick={() => onOpenShipment(order.id)}
            className="rounded border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7] disabled:opacity-50"
          >
            발송 처리
          </button>
        ) : isShipped ? (
          <span className="text-dot-primary">
            {order.trackingNumber ?? '—'}
          </span>
        ) : (
          <span className="text-dot-secondary">—</span>
        )}
      </td>
    </tr>
  )
}
