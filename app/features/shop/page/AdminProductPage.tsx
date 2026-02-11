import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCategories, fetchProduct, createProduct, updateProduct, uploadProductImages } from '../api/shop'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import { cn } from '@/common/lib/utils'
import { ArrowLeft, Plus, Trash2, Camera } from 'lucide-react'

export const AdminProductPage = () => {
  const { id: productId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditMode = !!productId

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [purchaseNotice, setPurchaseNotice] = useState('')
  const [handlingNotice, setHandlingNotice] = useState('')
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
    setDescription(product.description ?? '')
    setImages(
      product.images?.length
        ? product.images.map((img) => ({
            url: img.url,
            alt: img.alt ?? '',
            sortOrder: img.sortOrder,
          }))
        : []
    )
    setPurchaseNotice(product.purchaseNotice ?? '')
    setHandlingNotice(product.handlingNotice ?? '')
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
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'product', id] })
      queryClient.invalidateQueries({ queryKey: ['shop', 'products'] })
      alert('상품이 수정되었습니다.')
      navigate(`/shop/${productId}`)
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
      description: description || undefined,
      purchaseNotice: purchaseNotice.trim() || undefined,
      handlingNotice: handlingNotice.trim() || undefined,
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
      const { urls } = await uploadProductImages(files)
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

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => (isEditMode && productId ? navigate(`/shop/${productId}`) : navigate('/shop'))}
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

          {/* Description */}
          <label className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
              placeholder="Enter product description..."
            />
          </label>

          {/* 구매 전 안내사항 */}
          <label className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">
              구매 전 안내사항
            </span>
            <textarea
              value={purchaseNotice}
              onChange={(e) => setPurchaseNotice(e.target.value)}
              rows={4}
              className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
              placeholder="예: 전 과정 손으로 빚어 만드는 공정의 특성상 같은 제품이라도 약간의 차이가 있을 수 있습니다. 본 제품은 환불 불가 상품입니다."
            />
          </label>

          {/* 취급 및 구매 주의사항 */}
          <label className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">
              취급 및 구매 주의사항
            </span>
            <textarea
              value={handlingNotice}
              onChange={(e) => setHandlingNotice(e.target.value)}
              rows={6}
              className="rounded border border-[#ddd] bg-white px-4 py-3 text-sm focus:border-dot-primary focus:outline-none"
              placeholder="예: 한 개 한 개 손으로 빚어 만드는 제품 특성상 형태, 채색의 느낌이 사진과 다를 수 있습니다. 도자기 세척 시 스크래치를 주의하여 부드러운 스펀지를 이용해 주세요."
            />
          </label>

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
                클릭하여 이미지를 선택하세요 (jpg, png, gif, webp)
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
                클릭하여 상세 이미지를 선택하세요
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
              disabled={isPending}
              className={cn(
                'w-full bg-[#1A1A1A] py-4 text-xs font-medium uppercase tracking-widest text-white! transition-opacity hover:opacity-90',
                isPending && 'opacity-50'
              )}
            >
              {isPending
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
