import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCategories, fetchProduct, createProduct, updateProduct, uploadProductImages } from '../api/shop'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import { cn } from '@/common/lib/utils'
import { ArrowLeft, Plus, Trash2, Camera, Loader2 } from 'lucide-react'

const DETAIL_IMAGE_MAX_WIDTH = 2200
const DETAIL_IMAGE_QUALITY = 0.82
const DETAIL_IMAGE_COMPRESS_THRESHOLD = 2 * 1024 * 1024 // 2MB
const DEFAULT_STOCK_QUANTITY = 999

const shouldCompressDetailImage = (file: File): boolean => {
  if (file.size < DETAIL_IMAGE_COMPRESS_THRESHOLD) return false
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type)
}

const readImageSize = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지 크기 읽기에 실패했습니다.'))
    }
    img.src = url
  })

const compressDetailImage = async (file: File): Promise<File> => {
  const { width, height } = await readImageSize(file)
  if (!width || !height) return file

  const targetWidth = Math.min(width, DETAIL_IMAGE_MAX_WIDTH)
  const targetHeight = Math.round((height * targetWidth) / width)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('이미지 로딩에 실패했습니다.'))
    img.src = url
  })
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
  URL.revokeObjectURL(url)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', DETAIL_IMAGE_QUALITY)
  })
  if (!blob) return file

  const compressed = new File(
    [blob],
    file.name.replace(/\.[^/.]+$/, '.jpg'),
    { type: 'image/jpeg' },
  )

  // 압축 결과가 더 클 수 있는 예외 케이스 방지
  return compressed.size < file.size ? compressed : file
}

export const AdminProductPage = () => {
  const { id: productId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditMode = !!productId

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockQuantity, setStockQuantity] = useState(String(DEFAULT_STOCK_QUANTITY))
  const [images, setImages] = useState<{ url: string; alt: string; sortOrder: number }[]>([])
  const [detailImages, setDetailImages] = useState<{ url: string; alt: string; sortOrder: number }[]>([])
  const [options, setOptions] = useState([{ name: '', value: '', sortOrder: 1 }])
  const [error, setError] = useState<string | null>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingDetailImages, setUploadingDetailImages] = useState(false)

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
    setPrice(String(product.price))
    setCategoryId(product.categoryId)
    setStockQuantity(String(product.stockQuantity ?? DEFAULT_STOCK_QUANTITY))
    setImages(
      product.images?.length
        ? product.images.map((img) => ({
            url: img.url,
            alt: img.alt ?? '',
            sortOrder: img.sortOrder,
          }))
        : []
    )
    setDetailImages(
      product.detailImages?.length
        ? product.detailImages.map((img) => ({
            url: img.url,
            alt: img.alt ?? '',
            sortOrder: img.sortOrder,
          }))
        : []
    )
    setOptions(
      product.options?.length
        ? product.options.map((opt) => ({
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
    onError: (err: any) => {
      setError(getApiErrorMessage(err, '상품 등록에 실패했습니다.'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(id, data),
    onSuccess: (updatedProduct, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'product', id] })
      queryClient.invalidateQueries({ queryKey: ['shop', 'products'] })
      alert('상품이 수정되었습니다.')
      navigate(`/shop/${updatedProduct.slug ?? productId}`)
    },
    onError: (err: any) => {
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

    const payload = {
      name,
      slug,
      price: parseInt(price, 10),
      categoryId,
      stockQuantity: (() => {
        const n = Number(stockQuantity)
        if (!Number.isFinite(n)) return DEFAULT_STOCK_QUANTITY
        // 음수 재고는 허용하지 않음
        return Math.max(0, Math.floor(n))
      })(),
      images: images.map((img, i) => ({ ...img, sortOrder: i + 1 })),
      detailImages: detailImages.map((img, i) => ({ ...img, sortOrder: i + 1 })),
      options: options.filter((opt) => opt.name.trim() !== '' && opt.value.trim() !== ''),
    }

    if (isEditMode && productId) {
      updateMutation.mutate({ id: productId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (!files.length) return
    e.target.value = ''
    setUploadingImages(true)
    try {
      const { urls } = await uploadProductImages(files)
      setImages((prev) => [
        ...prev,
        ...urls.map((url, i) => ({ url, alt: '', sortOrder: prev.length + i + 1 })),
      ])
    } catch (err: any) {
      setError(err?.message || '이미지 업로드에 실패했습니다.')
    } finally {
      setUploadingImages(false)
    }
  }

  const removeImageField = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const addOptionField = () => {
    setOptions([...options, { name: '', value: '', sortOrder: options.length + 1 }])
  }

  const removeOptionField = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleDetailImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (!files.length) return
    e.target.value = ''
    setUploadingDetailImages(true)
    try {
      const preparedFiles = await Promise.all(
        files.map(async (file) => {
          if (!shouldCompressDetailImage(file)) return file
          return compressDetailImage(file)
        })
      )
      const { urls } = await uploadProductImages(preparedFiles)
      setDetailImages((prev) => [
        ...prev,
        ...urls.map((url, i) => ({ url, alt: '', sortOrder: prev.length + i + 1 })),
      ])
    } catch (err: any) {
      setError(err?.message || '이미지 업로드에 실패했습니다.')
    } finally {
      setUploadingDetailImages(false)
    }
  }

  const removeDetailImageField = (index: number) => {
    setDetailImages(detailImages.filter((_, i) => i !== index))
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
  const isUploading = uploadingImages || uploadingDetailImages

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded bg-white px-5 py-3 text-dot-primary shadow-md">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">이미지 업로드 중입니다...</span>
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
                placeholder="e.g. MOONLIGHT VASE"
                required
              />
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
                placeholder="e.g. moonlight-vase"
                required
              />
            </label>

            {/* Price */}
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666]">
                Price (KRW) <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="e.g. 82000"
                required
              />
            </label>

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
                placeholder="e.g. 999"
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

          {/* Images (파일 직접 첨부) */}
          <div className="space-y-4">
            <span className="block text-[10px] uppercase tracking-widest text-[#666]">
              Images
            </span>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#ddd] bg-[#fafafa] py-8 transition-colors hover:bg-[#f5f5f5]">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="sr-only"
                onChange={handleImagesUpload}
                disabled={uploadingImages}
              />
              <Camera className="mb-2 h-10 w-10 text-[#999]" strokeWidth={1.5} />
              <span className="text-sm font-medium text-dot-primary">
                {uploadingImages ? '업로드 중…' : '사진 첨부하기'}
              </span>
              <span className="mt-1 text-xs text-[#888]">
                클릭하여 이미지를 선택하세요 (jpg, png, gif, webp, 최대 30MB/파일)
              </span>
            </label>
            {images.length > 0 && (
              <div className="mt-4 space-y-3">
                {images.map((img, index) => (
                  <div key={index} className="flex gap-4 items-start">
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

          {/* 상세 이미지 (상품 상세 하단, 파일 직접 첨부) */}
          <div className="space-y-4">
            <span className="block text-[10px] uppercase tracking-widest text-[#666]">
              상세 이미지 (상품 상세 하단)
            </span>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#ddd] bg-[#fafafa] py-8 transition-colors hover:bg-[#f5f5f5]">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="sr-only"
                onChange={handleDetailImagesUpload}
                disabled={uploadingDetailImages}
              />
              <Camera className="mb-2 h-10 w-10 text-[#999]" strokeWidth={1.5} />
              <span className="text-sm font-medium text-dot-primary">
                {uploadingDetailImages ? '업로드 중…' : '사진 첨부하기'}
              </span>
              <span className="mt-1 text-xs text-[#888]">
                클릭하여 상세 이미지를 선택하세요 (큰 파일은 자동 압축됩니다, 최대 30MB/파일)
              </span>
            </label>
            {detailImages.length > 0 && (
              <div className="mt-4 space-y-3">
                {detailImages.map((img, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    <img
                      src={img.url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded border border-[#eee] object-cover"
                    />
                    <input
                      type="text"
                      value={img.alt}
                      onChange={(e) => {
                        const next = [...detailImages]
                        next[index] = { ...next[index], alt: e.target.value }
                        setDetailImages(next)
                      }}
                      className="flex-1 rounded border border-[#ddd] bg-white px-4 py-2.5 text-sm focus:border-dot-primary focus:outline-none"
                      placeholder="Alt"
                    />
                    <button
                      type="button"
                      onClick={() => removeDetailImageField(index)}
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
                Options (e.g. Finish: Matte White)
              </span>
              <button
                type="button"
                onClick={addOptionField}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-dot-primary hover:opacity-80 transition-opacity"
              >
                <Plus size={12} /> Add Option
              </button>
            </div>
            {options.map((opt, index) => (
              <div key={index} className="flex gap-4">
                <input
                  type="text"
                  value={opt.name}
                  onChange={(e) => {
                    const newOptions = [...options]
                    newOptions[index].name = e.target.value
                    setOptions(newOptions)
                  }}
                  className="flex-1 rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="Option Name (e.g. Finish)"
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
                  placeholder="Option Value (e.g. Matte White)"
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
