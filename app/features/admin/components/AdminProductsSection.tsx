import { useState } from 'react'
import {
  type Product,
  createCategory,
  deleteCategory,
  deleteProduct,
  fetchCategories,
  fetchProducts,
  updateCategory,
} from '@/features/shop/api/shop'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ProductPrice } from '@/features/shop/components/ProductPrice'

export const AdminProductsSection = () => {
  const queryClient = useQueryClient()
  const [categoryName, setCategoryName] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [categorySortOrder, setCategorySortOrder] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  )
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategorySlug, setEditingCategorySlug] = useState('')
  const [editingCategorySortOrder, setEditingCategorySortOrder] = useState('0')

  const { data: categories = [] } = useQuery({
    queryKey: ['shop', 'categories'],
    queryFn: fetchCategories,
  })

  const {
    data: products,
    isLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['shop', 'admin', 'products'],
    queryFn: () => fetchProducts(),
  })

  const createCategoryMutation = useMutation({
    mutationFn: () =>
      createCategory({
        name: categoryName.trim(),
        slug: categorySlug.trim(),
        sortOrder: Number(categorySortOrder) || 0,
      }),
    onSuccess: () => {
      setCategoryName('')
      setCategorySlug('')
      setCategorySortOrder('')
      queryClient.invalidateQueries({ queryKey: ['shop', 'categories'] })
      alert('카테고리가 생성되었습니다.')
    },
    onError: (err: unknown) => {
      alert(
        err instanceof Error ? err.message : '카테고리 생성에 실패했습니다.'
      )
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'admin', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['shop', 'products'] })
      alert('상품이 삭제되었습니다.')
    },
    onError: (err: unknown) => {
      alert(err instanceof Error ? err.message : '상품 삭제에 실패했습니다.')
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: (data: {
      id: string
      name: string
      slug: string
      sortOrder: number
    }) =>
      updateCategory(data.id, {
        name: data.name,
        slug: data.slug,
        sortOrder: data.sortOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'categories'] })
      setEditingCategoryId(null)
      setEditingCategoryName('')
      setEditingCategorySlug('')
      setEditingCategorySortOrder('0')
      alert('카테고리가 수정되었습니다.')
    },
    onError: (err: unknown) => {
      alert(
        err instanceof Error ? err.message : '카테고리 수정에 실패했습니다.'
      )
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'categories'] })
      alert('카테고리가 삭제되었습니다.')
    },
    onError: (err: unknown) => {
      alert(
        err instanceof Error ? err.message : '카테고리 삭제에 실패했습니다.'
      )
    },
  })

  if (isLoading) {
    return <div className="text-dot-secondary">Loading…</div>
  }

  if (productsError) {
    return (
      <div className="rounded border border-[#eee] bg-white p-8 text-center text-dot-secondary">
        <p className="text-sm">상품 목록을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => void refetchProducts()}
          className="mono mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-dot-primary underline underline-offset-4"
        >
          다시 시도
        </button>
      </div>
    )
  }

  const list = products ?? []
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryName.trim() || !categorySlug.trim()) {
      alert('카테고리 이름과 slug를 입력해 주세요.')
      return
    }
    createCategoryMutation.mutate()
  }

  const startEditCategory = (id: string) => {
    const target = categories.find((c) => c.id === id)
    if (!target) return
    setEditingCategoryId(id)
    setEditingCategoryName(target.name)
    setEditingCategorySlug(target.slug)
    setEditingCategorySortOrder(String(target.sortOrder ?? 0))
  }

  const cancelEditCategory = () => {
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setEditingCategorySlug('')
    setEditingCategorySortOrder('0')
  }

  const submitEditCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategoryId) return
    if (!editingCategoryName.trim() || !editingCategorySlug.trim()) {
      alert('카테고리 이름과 slug를 입력해 주세요.')
      return
    }
    updateCategoryMutation.mutate({
      id: editingCategoryId,
      name: editingCategoryName.trim(),
      slug: editingCategorySlug.trim(),
      sortOrder: Number(editingCategorySortOrder) || 0,
    })
  }

  return (
    <section className="space-y-8">
      <form
        onSubmit={handleCreateCategory}
        className="rounded border border-[#eee] bg-white p-4"
      >
        <h3 className="font-serif text-lg tracking-[0.06em] text-dot-primary">
          CATEGORY CREATE
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_140px_120px]">
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="카테고리 이름"
            className="rounded border border-[#ddd] px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
          />
          <input
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            placeholder="slug (예: tableware)"
            className="rounded border border-[#ddd] px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
          />
          <input
            type="number"
            value={categorySortOrder}
            onChange={(e) => setCategorySortOrder(e.target.value)}
            placeholder="정렬 기준 (기본값 0)"
            className="rounded border border-[#ddd] px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={createCategoryMutation.isPending}
            className="rounded bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {createCategoryMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>

      <div className="rounded border border-[#eee] bg-white">
        <div className="border-b border-[#eee] px-4 py-3">
          <h3 className="font-serif text-lg tracking-[0.06em] text-dot-primary">
            CATEGORY LIST
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[#eee] text-left text-[0.85rem] text-dot-secondary">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Sort</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-dot-secondary"
                  >
                    No categories
                  </td>
                </tr>
              ) : (
                categories.map((category) => {
                  const isEditing = editingCategoryId === category.id
                  return (
                    <tr key={category.id} className="border-b border-[#f3f3f3]">
                      <td className="px-4 py-3 text-dot-primary">
                        {isEditing ? (
                          <input
                            value={editingCategoryName}
                            onChange={(e) =>
                              setEditingCategoryName(e.target.value)
                            }
                            className="w-full rounded border border-[#ddd] px-2 py-1 text-sm focus:border-dot-primary focus:outline-none"
                          />
                        ) : (
                          category.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-dot-secondary">
                        {isEditing ? (
                          <input
                            value={editingCategorySlug}
                            onChange={(e) =>
                              setEditingCategorySlug(e.target.value)
                            }
                            className="w-full rounded border border-[#ddd] px-2 py-1 text-sm focus:border-dot-primary focus:outline-none"
                          />
                        ) : (
                          category.slug
                        )}
                      </td>
                      <td className="px-4 py-3 text-dot-secondary">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editingCategorySortOrder}
                            onChange={(e) =>
                              setEditingCategorySortOrder(e.target.value)
                            }
                            className="w-24 rounded border border-[#ddd] px-2 py-1 text-sm focus:border-dot-primary focus:outline-none"
                          />
                        ) : (
                          category.sortOrder
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <form
                            onSubmit={submitEditCategory}
                            className="flex gap-2"
                          >
                            <button
                              type="submit"
                              disabled={updateCategoryMutation.isPending}
                              className="rounded bg-[#1A1A1A] px-3 py-2 text-[0.82rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditCategory}
                              className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.82rem] font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditCategory(category.id)}
                              className="rounded bg-[#1A1A1A] px-3 py-2 text-[0.82rem] font-medium text-white transition-opacity hover:opacity-90"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `"${category.name}" 카테고리를 삭제할까요?`
                                  )
                                )
                                  return
                                deleteCategoryMutation.mutate(category.id)
                              }}
                              className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.82rem] font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-[0.08em] text-dot-primary">
          PRODUCTS
        </h2>
        <Link
          to="/shop/admin/new"
          className="rounded border border-dot-primary bg-white px-4 py-2 text-[0.85rem] font-medium text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
        >
          Add product
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-[#eee] bg-white">
        <table className="min-w-[920px] border-collapse">
          <thead>
            <tr className="border-b border-[#eee] text-left text-[0.85rem] text-dot-secondary">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3 whitespace-nowrap">Stock</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3 whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-dot-secondary"
                >
                  No products
                </td>
              </tr>
            ) : (
              list.map((p: Product) => (
                <tr key={p.id} className="border-b border-[#f3f3f3]">
                  <td className="px-4 py-3 text-dot-primary">{p.name}</td>
                  <td className="px-4 py-3 text-dot-secondary">
                    {categoryNameById.get(p.categoryId) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-dot-primary">
                    <ProductPrice
                      product={p}
                      className="text-sm"
                      originalClassName="text-xs"
                      rateClassName="text-xs"
                    />
                  </td>
                  <td className="px-4 py-3 text-dot-primary">
                    <span className="mono text-sm">{p.stockQuantity ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-dot-secondary">{p.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3 whitespace-nowrap">
                      <Link
                        to={`/shop/admin/edit/${p.id}`}
                        className="rounded bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white! transition-opacity hover:opacity-90 hover:text-white! focus:text-white!"
                      >
                        수정
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`"${p.name}" 상품을 삭제할까요?`))
                            return
                          deleteProductMutation.mutate(p.id)
                        }}
                        className="rounded border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
