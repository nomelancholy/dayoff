import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCategories,
  fetchProduct,
  createProduct,
  updateProduct,
  uploadProductImages,
} from '../api/shop'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import { cn } from '@/common/lib/utils'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Camera,
  Loader2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { calculateDiscountedPrice } from '../lib/pricing'

const DEFAULT_STOCK_QUANTITY = 999
const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DEFAULT_PRODUCT_GUIDE = [
  '디오티에서 생산되는 모든 제품들은 수공예품으로 사람의 손을 거쳐 오랜시간 여러과정으로 만들어집니다. 따라서 이과정에서 나타나는 자연스러운 현상들은 소지(흙)과 유약(산화물)들의 결합에서 나타나는 반응, 가마 내부위치의 불의 방향과 온도에따라 미세한 차이가 나타날 수 있습니다.',
  '',
  '색 유약을 사용하므로 나타나는 시유시 나타나는 유약의 흐름, 소성반응으로 흙과 유약에 있는 성분이 날아와 나타나는 미세한 철 점, 작은 크랙과 핀홀들은 불량이 아닙니다.',
  '가마에 소성하기 위해서 바닥아 맞닿은 부분은 닦아내므로 색상이 다르며 유약이 약간 남아있거나 내화판의 알갱이 자국이 남아있을 수 있습니다.',
  '최대한 손으로 마감처리를 깔끔하게 하기위해 노력하고 있으나 수작업의 특성으로 공장형 제품보다 디테일이 다른 매력으로 봐주시면 감사하겠습니다.',
].join('\n')

const DEFAULT_SHIPPING_NOTICE = [
  '배송비',
  '-기본 배송비 : 3,500원',
  '-제주도 및 도서·산간 지역 : 5,000원',
  '-100,000원 이상 구매시 무료 배송',
  '-단순 변심(색상 및 제품 변경 포함)으로 인한 교환·반품 시 왕복 배송비 6,000원은 고객 부담입니다.',
  '',
  '*택배사 배송 일정에 따라 출고일 기준 1~2일 소요될 수 있습니다.',
  '*재고가 없을 경우 10~14일 정도 소요될 수 있습니다.',
].join('\n')

const DEFAULT_EXCHANGE_RETURN_NOTICE = [
  '- 제품 반송 방법',
  '',
  '  교환 및 반품 [마이페이지 > 1:1 문의]를 통해 접수해 주세요.',
  '  교환/환불시 수령 받은 본품을 포함한 모든 구성품이 동봉되어 있어야 하며, 구성품을 분실하거나 재포장의 부주의로 훼손된 경우 교환/환불처리가 어려울 수 있습니다.',
  '(동봉하지 않을 경우 추가비용이 발생할 수 있습니다. )',
  '반품 입고 후 이상 없을 시 최초 결제 해주신 방법에 따라 환불이 진행됩니다.',
  '',
  '- 교환 및 반품 불가',
  '',
  '  전자상거래법에 의거하여 교환/반품은 상품 수령일로 부터 7일이내 가능합니다. 기한이 경과된 경우 교환·반품이 불가합니다.',
  '  공정거래 표준약관 제 15조 2항에 의한 이용자의 사용 또는 일부 소비에 의하여 재화 등의 가치가 현저히 감소한 경우 (고객 부주의로 인한 파손, 사용흔적 오염 및 생활기스)',
  '  제품 특성에 대한 안내사항에 기재된 내용에 해당하는 경우 (미세한 철점, 색감 차이, 유약의 흐름 등)',
  '  사이즈 측정 방법에 따른 표기 된 사이즈의 오차 (0.5~1cm)',
  '  모니터 해상도의 차이 및 조명(삼파장, LED, 자연광 등)에 따른 색상 차이',
].join('\n')

const DEFAULT_CARE_GUIDE = [
  '- 내열에 강한 제품이 아니므로 오븐, 에어프라이어 같은 강한 열에 주의하십시오.',
  '- 전자레인지와 식기세척기에 사용 가능합니다.',
  '- 매트한 유약 특성으로 오염과 스크래치를 주의해주세요.',
].join('\n')

export const AdminProductPage = () => {
  const { id: productId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditMode = !!productId

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [price, setPrice] = useState('')
  const [discountRate, setDiscountRate] = useState('0')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockQuantity, setStockQuantity] = useState(
    String(DEFAULT_STOCK_QUANTITY)
  )
  const [purchaseNotice, setPurchaseNotice] = useState(DEFAULT_PRODUCT_GUIDE)
  const [shippingNotice, setShippingNotice] = useState(DEFAULT_SHIPPING_NOTICE)
  const [exchangeReturnNotice, setExchangeReturnNotice] = useState(
    DEFAULT_EXCHANGE_RETURN_NOTICE
  )
  const [careGuide, setCareGuide] = useState(DEFAULT_CARE_GUIDE)
  const [images, setImages] = useState<
    { url: string; alt: string; sortOrder: number }[]
  >([])
  const [options, setOptions] = useState<
    { id?: string; name: string; value: string; sortOrder: number }[]
  >([{ name: '', value: '', sortOrder: 1 }])
  const [error, setError] = useState<string | null>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(
    null
  )

  const { data: categories } = useQuery({
    queryKey: ['shop', 'categories'],
    queryFn: fetchCategories,
  })

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['shop', 'product', productId],
    queryFn: () => fetchProduct(productId!),
    enabled: isEditMode && !!productId,
  })

  useEffect(() => {
    if (!product) return
    setName(product.name)
    setSlug(product.slug)
    setPrice(String(product.originalPrice ?? product.price))
    setDiscountRate(String(product.discountRate ?? 0))
    setDescription(product.description ?? '')
    setCategoryId(product.categoryId)
    setStockQuantity(String(product.stockQuantity ?? DEFAULT_STOCK_QUANTITY))
    setPurchaseNotice(product.purchaseNotice ?? '')
    setShippingNotice(product.shippingNotice ?? '')
    setExchangeReturnNotice(product.exchangeReturnNotice ?? '')
    setCareGuide(product.careGuide ?? product.handlingNotice ?? '')
    setImages(
      product.images?.length
        ? product.images.map((img) => ({
            url: img.url,
            alt: img.alt ?? '',
            sortOrder: img.sortOrder,
          }))
        : []
    )
    setOptions(
      product.options?.length
        ? product.options.map((opt) => ({
            id: opt.id,
            name: opt.name,
            value: opt.value,
            sortOrder: opt.sortOrder,
          }))
        : [{ name: '', value: '', sortOrder: 1 }]
    )
  }, [product])

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      alert('상품이 등록되었습니다.')
      navigate('/shop')
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, '상품 등록에 실패했습니다.'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Parameters<typeof updateProduct>[1]
    }) => updateProduct(id, data),
    onSuccess: (updatedProduct, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'product', id] })
      queryClient.invalidateQueries({ queryKey: ['shop', 'products'] })
      alert('상품이 수정되었습니다.')
      navigate(`/shop/${updatedProduct.slug ?? productId}`)
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, '상품 수정에 실패했습니다.'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name || !slug || !price || !categoryId) {
      setError('필수 항목을 모두 입력해 주세요.')
      return
    }

    const normalizedSlug = slug.trim()
    if (!PRODUCT_SLUG_PATTERN.test(normalizedSlug)) {
      setError('Slug는 영문 소문자, 숫자, 하이픈(-)만 입력해 주세요.')
      return
    }

    const normalizedPrice = Number(price)
    const normalizedDiscountRate = Number(discountRate || 0)
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      setError('정상가는 0 이상의 숫자로 입력해 주세요.')
      return
    }
    if (
      !Number.isFinite(normalizedDiscountRate) ||
      normalizedDiscountRate < 0 ||
      normalizedDiscountRate > 100
    ) {
      setError('할인율은 0~100 사이로 입력해 주세요.')
      return
    }

    const roundedPrice = Math.floor(normalizedPrice)
    const roundedDiscountRate = Math.floor(normalizedDiscountRate)
    const salePrice = calculateDiscountedPrice(
      roundedPrice,
      roundedDiscountRate
    )

    const payload = {
      name,
      slug: normalizedSlug,
      price: roundedDiscountRate > 0 ? salePrice : roundedPrice,
      originalPrice: roundedDiscountRate > 0 ? roundedPrice : null,
      discountRate: roundedDiscountRate,
      description,
      categoryId,
      stockQuantity: (() => {
        const n = Number(stockQuantity)
        if (!Number.isFinite(n)) return DEFAULT_STOCK_QUANTITY
        // 음수 재고는 허용하지 않음
        return Math.max(0, Math.floor(n))
      })(),
      purchaseNotice,
      shippingNotice,
      exchangeReturnNotice,
      careGuide,
      handlingNotice: careGuide,
      images: images.map((img, i) => ({ ...img, sortOrder: i + 1 })),
      options: options.filter(
        (opt) => opt.name.trim() !== '' && opt.value.trim() !== ''
      ),
    }

    if (isEditMode && productId) {
      updateMutation.mutate({ id: productId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const uploadImages = async (files: File[]) => {
    if (!files.length) return
    setUploadingImages(true)
    setError(null)
    try {
      const { urls } = await uploadProductImages(files)
      setImages((prev) => [
        ...prev,
        ...urls.map((url, i) => ({
          url,
          alt: '',
          sortOrder: prev.length + i + 1,
        })),
      ])
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.'
      )
    } finally {
      setUploadingImages(false)
    }
  }

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    void uploadImages(files)
  }

  const handleImagesDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDraggingFiles(false)
    if (uploadingImages) return
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    )
    if (!files.length) {
      setError('이미지 파일만 드래그해서 넣을 수 있습니다.')
      return
    }
    void uploadImages(files)
  }

  const moveImage = (from: number, to: number) => {
    if (from === to || to < 0 || to >= images.length) return
    setImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((image, index) => ({
        ...image,
        sortOrder: index + 1,
      }))
    })
  }

  const handleImageDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number
  ) => {
    e.preventDefault()
    if (draggedImageIndex !== null) {
      moveImage(draggedImageIndex, targetIndex)
    }
    setDraggedImageIndex(null)
  }

  const removeImageField = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const addOptionField = () => {
    setOptions([
      ...options,
      { name: '', value: '', sortOrder: options.length + 1 },
    ])
  }

  const removeOptionField = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  if (isEditMode && productLoading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
        <div className="mx-auto max-w-3xl animate-pulse">
          <div className="mb-8 h-4 w-32 bg-[#eee]" />
          <div className="h-12 w-64 bg-[#eee]" />
          <div className="mt-12 h-64 w-full bg-[#eee]" />
        </div>
      </div>
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isUploading = uploadingImages
  const pricePreviewOriginal = Math.max(0, Math.floor(Number(price) || 0))
  const pricePreviewRate = Math.min(
    100,
    Math.max(0, Math.floor(Number(discountRate) || 0))
  )
  const pricePreviewSale = calculateDiscountedPrice(
    pricePreviewOriginal,
    pricePreviewRate
  )

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded bg-white px-5 py-3 text-dot-primary shadow-md">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">
              이미지 업로드 중입니다...
            </span>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() =>
            isEditMode && productId
              ? navigate(`/shop/${product?.slug ?? productId}`)
              : navigate('/shop')
          }
          className="mb-8 flex items-center gap-2 text-xs uppercase tracking-widest text-[#999] hover:text-dot-primary transition-colors"
        >
          <ArrowLeft size={14} />
          {isEditMode ? 'Back to Product' : 'Back to Shop'}
        </button>

        <h1 className="font-serif text-4xl tracking-[0.12em] text-dot-primary">
          {isEditMode ? 'Edit Product' : 'Add New Product'}
        </h1>

        <form onSubmit={handleSubmit} className="mt-12 space-y-8">
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Name */}
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Product Name <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="예: 폼폰 컵 (Blue) / Pompon Cup"
                required
              />
              <span className="text-xs leading-relaxed text-[#888]">
                한글·영문·숫자와 일반 기호를 사용할 수 있습니다.
              </span>
            </label>

            {/* Slug */}
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Slug (URL Identifier) <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="예: pompon-cup-blue"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title="영문 소문자, 숫자, 하이픈(-)만 입력해 주세요."
                autoCapitalize="none"
                spellCheck={false}
                required
              />
              <span className="text-xs leading-relaxed text-[#888]">
                URL에 사용됩니다. 영문 소문자·숫자·하이픈(-)만 입력할 수
                있습니다.
              </span>
            </label>

            {/* Regular price */}
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Original Price (KRW) <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="정상가 예: 39000"
                min={0}
                step={1}
                required
              />
              <span className="text-xs leading-relaxed text-[#888]">
                할인 전 정상가를 쉼표 없이 입력해 주세요.
              </span>
            </label>

            {/* Discount rate */}
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Discount Rate (%)
              </span>
              <input
                type="number"
                value={discountRate}
                onChange={(e) => setDiscountRate(e.target.value)}
                className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="할인 없음: 0 / 예: 20"
                min={0}
                max={100}
                step={1}
              />
              <span className="text-xs leading-relaxed text-[#888]">
                할인이 없으면 0, 있으면 1~100 사이 숫자를 입력해 주세요.
              </span>
            </label>

            <div className="flex flex-col gap-2 md:col-span-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Price Preview
              </span>
              <div className="flex min-h-12 flex-wrap items-center gap-3 rounded border border-[#e4e0da] bg-[#f4f1ec] px-4 py-3 text-sm">
                {pricePreviewRate > 0 && pricePreviewOriginal > 0 ? (
                  <>
                    <span className="text-[#888] line-through">
                      {pricePreviewOriginal.toLocaleString('ko-KR')} 원
                    </span>
                    <span className="font-medium text-[#A45B3F]">
                      {pricePreviewRate}%
                    </span>
                  </>
                ) : null}
                <strong className="font-medium text-dot-primary">
                  {(pricePreviewRate > 0
                    ? pricePreviewSale
                    : pricePreviewOriginal
                  ).toLocaleString('ko-KR')}{' '}
                  원
                </strong>
              </div>
            </div>

            {/* Stock */}
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                STOCK <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="예: 10"
                required
              />
              <span className="text-xs text-[#888]">
                0 이하면 품절로 처리됩니다.
              </span>
            </label>

            {/* Category */}
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Category <span className="text-red-500">*</span>
              </span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                required
              >
                <option value="">Select Category</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">
              상품 상세 설명
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm leading-relaxed focus:border-dot-primary focus:outline-none"
              placeholder="상품의 소재, 특징, 제작 방식 등 상세 설명을 입력해 주세요. 줄바꿈도 그대로 표시됩니다."
            />
            <span className="text-xs leading-relaxed text-[#888]">
              상품 상세 페이지에서 가격 아래, 옵션 위에 표시됩니다.
            </span>
          </label>

          {/* Product guide tab content */}
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-lg tracking-[0.08em] text-dot-primary">
                상품별 안내 문구
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#888]">
                상품 상세의 두 안내 탭에 아래 항목들이 나뉘어 노출됩니다.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <fieldset className="space-y-5 rounded border border-[#eee] bg-white p-5">
                <div>
                  <h3 className="mono text-sm tracking-[0.1em] text-dot-primary">
                    PRODUCT GUIDE
                  </h3>
                  <p className="mt-1 text-xs text-[#888]">
                    PLEASE NOTE · CARE GUIDE
                  </p>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#666]">
                    PLEASE NOTE
                  </span>
                  <textarea
                    value={purchaseNotice}
                    onChange={(e) => setPurchaseNotice(e.target.value)}
                    rows={6}
                    className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm leading-relaxed focus:border-dot-primary focus:outline-none"
                    placeholder="상품별 주의사항을 입력해 주세요."
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#666]">
                    CARE GUIDE
                  </span>
                  <textarea
                    value={careGuide}
                    onChange={(e) => setCareGuide(e.target.value)}
                    rows={6}
                    className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm leading-relaxed focus:border-dot-primary focus:outline-none"
                    placeholder="상품별 케어 가이드를 입력해 주세요."
                  />
                </label>
              </fieldset>

              <fieldset className="space-y-5 rounded border border-[#eee] bg-white p-5">
                <div>
                  <h3 className="mono text-sm tracking-[0.1em] text-dot-primary">
                    SHIPPING &amp; RETURNS
                  </h3>
                  <p className="mt-1 text-xs text-[#888]">
                    SHIPPING · RETURNS / EXCHANGES
                  </p>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#666]">
                    SHIPPING
                  </span>
                  <textarea
                    value={shippingNotice}
                    onChange={(e) => setShippingNotice(e.target.value)}
                    rows={6}
                    className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm leading-relaxed focus:border-dot-primary focus:outline-none"
                    placeholder="상품별 배송 안내를 입력해 주세요."
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#666]">
                    RETURNS / EXCHANGES
                  </span>
                  <textarea
                    value={exchangeReturnNotice}
                    onChange={(e) => setExchangeReturnNotice(e.target.value)}
                    rows={6}
                    className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm leading-relaxed focus:border-dot-primary focus:outline-none"
                    placeholder="상품별 교환/반품 안내를 입력해 주세요."
                  />
                </label>
              </fieldset>
            </div>
          </div>

          {/* Images (파일 직접 첨부) */}
          <div className="space-y-4">
            <span className="block text-[10px] uppercase tracking-widest text-[#666]">
              Images
            </span>
            <label
              onDragEnter={(e) => {
                e.preventDefault()
                setIsDraggingFiles(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
                setIsDraggingFiles(true)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setIsDraggingFiles(false)
                }
              }}
              onDrop={handleImagesDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 transition-colors',
                isDraggingFiles
                  ? 'border-dot-primary bg-[#efebe4]'
                  : 'border-[#ddd] bg-[#fafafa] hover:bg-[#f5f5f5]'
              )}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="sr-only"
                onChange={handleImagesUpload}
                disabled={uploadingImages}
              />
              <Camera
                className="mb-2 h-10 w-10 text-[#999]"
                strokeWidth={1.5}
              />
              <span className="text-sm font-medium text-dot-primary">
                {uploadingImages
                  ? '업로드 중…'
                  : isDraggingFiles
                    ? '여기에 놓아주세요'
                    : '사진을 드래그하거나 클릭해서 첨부'}
              </span>
              <span className="mt-1 text-xs text-[#888]">
                jpg, png, gif, webp · 최대 30MB/파일 · 여러 장 가능
              </span>
            </label>
            {images.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs leading-relaxed text-[#888]">
                  왼쪽 손잡이를 드래그해 순서를 바꿀 수 있습니다. 첫 번째 사진이
                  대표 이미지로 노출됩니다.
                </p>
                {images.map((img, index) => (
                  <div
                    key={`${img.url}-${index}`}
                    onDragOver={(e) => {
                      if (draggedImageIndex === null) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => handleImageDrop(e, index)}
                    className={cn(
                      'flex items-center gap-3 rounded border bg-white p-3 transition-colors',
                      draggedImageIndex === index
                        ? 'border-dot-primary opacity-60'
                        : 'border-[#eee]'
                    )}
                  >
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        setDraggedImageIndex(index)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(index))
                      }}
                      onDragEnd={() => setDraggedImageIndex(null)}
                      className="cursor-grab touch-none text-[#aaa] active:cursor-grabbing"
                      aria-label={`${index + 1}번 이미지 순서 이동`}
                      title="드래그해서 순서 변경"
                    >
                      <GripVertical size={20} />
                    </button>
                    <span className="mono w-5 shrink-0 text-center text-xs text-[#999]">
                      {index + 1}
                    </span>
                    <img
                      src={img.url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded border border-[#eee] object-cover"
                    />
                    <input
                      type="text"
                      value={img.alt}
                      onChange={(e) => {
                        const next = [...images]
                        next[index] = { ...next[index], alt: e.target.value }
                        setImages(next)
                      }}
                      className="flex-1 rounded border border-[#ddd] bg-white px-4 py-2.5 text-sm focus:border-dot-primary focus:outline-none"
                      placeholder="Alt Text"
                    />
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => moveImage(index, index - 1)}
                        disabled={index === 0}
                        className="text-[#999] transition-colors hover:text-dot-primary disabled:cursor-not-allowed disabled:opacity-25"
                        aria-label="이미지를 한 칸 위로 이동"
                      >
                        <ChevronUp size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(index, index + 1)}
                        disabled={index === images.length - 1}
                        className="text-[#999] transition-colors hover:text-dot-primary disabled:cursor-not-allowed disabled:opacity-25"
                        aria-label="이미지를 한 칸 아래로 이동"
                      >
                        <ChevronDown size={18} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImageField(index)}
                      className="text-[#999] hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Options
              </span>
              <button
                type="button"
                onClick={addOptionField}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-dot-primary hover:opacity-80 transition-opacity"
              >
                <Plus size={12} /> Add Option
              </button>
            </div>
            <p className="text-xs leading-relaxed text-[#888]">
              옵션명과 옵션값은 한글·영문·숫자 입력이 가능합니다. 예: 사이즈:
              대형 / Size: Large
            </p>
            {options.map((opt, index) => (
              <div key={opt.id ?? index} className="flex gap-4">
                <input
                  type="text"
                  value={opt.name}
                  onChange={(e) => {
                    const newOptions = [...options]
                    newOptions[index].name = e.target.value
                    setOptions(newOptions)
                  }}
                  className="flex-1 rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="옵션명 예: 사이즈 / Size"
                />
                <input
                  type="text"
                  value={opt.value}
                  onChange={(e) => {
                    const newOptions = [...options]
                    newOptions[index].value = e.target.value
                    setOptions(newOptions)
                  }}
                  className="flex-1 rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="옵션값 예: 대형 / Large"
                />
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOptionField(index)}
                    className="text-[#999] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isPending || isUploading}
            className={cn(
              'w-full bg-[#1A1A1A] py-4 text-xs font-medium uppercase tracking-widest text-white! transition-opacity hover:opacity-90',
              (isPending || isUploading) && 'opacity-50'
            )}
          >
            {isUploading
              ? 'Uploading Images...'
              : isPending
                ? isEditMode
                  ? 'Updating...'
                  : 'Registering...'
                : isEditMode
                  ? 'Update Product'
                  : 'Register Product'}
          </button>
        </form>
      </div>
    </div>
  )
}
