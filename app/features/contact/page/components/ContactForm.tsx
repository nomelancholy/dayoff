import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { submitContactInquiry } from '@/features/contact/api/contact'
import { cn } from '@/common/lib/utils'

const CATEGORIES = [
  '상품 문의',
  '주문·배송 문의',
  '클래스 문의',
  '협업·제휴 문의',
  '기타',
]
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const INPUT_CLASS =
  'w-full rounded-full border border-[#d5d0c8] bg-white px-5 py-3 text-base text-dot-primary outline-none transition-colors focus:border-dot-primary focus:ring-1 focus:ring-dot-primary'
const LABEL_CLASS = 'mb-3 block text-sm text-dot-primary'

export const ContactForm = () => {
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [formError, setFormError] = useState('')
  const mutation = useMutation({
    mutationFn: submitContactInquiry,
    retry: false,
    onSuccess: () => {
      formRef.current?.reset()
      setFileName('')
      setFileError('')
      setFormError('')
    },
  })

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setFileError('')
    if (
      file &&
      (!FILE_TYPES.includes(file.type) ||
        file.size === 0 ||
        file.size > 5 * 1024 * 1024)
    ) {
      setFileError('JPG, PNG, WEBP, PDF 파일을 5MB 이하로 첨부해 주세요.')
      event.target.value = ''
      setFileName('')
      return
    }
    setFileName(file?.name ?? '')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mutation.isPending || fileError) return
    setFormError('')
    mutation.reset()
    const data = new FormData(event.currentTarget)
    for (const field of ['name', 'email', 'subject', 'message']) {
      const value = String(data.get(field) ?? '').trim()
      if (!value) {
        setFormError('필수 항목에 내용을 입력해 주세요.')
        return
      }
      data.set(field, value)
    }
    const file = data.get('attachment')
    if (file instanceof File && !file.name) data.delete('attachment')
    mutation.mutate(data)
  }

  return (
    <section
      className="reveal-element mt-24 border-t border-[#ded9d2] pt-16 md:mt-32 md:pt-20"
      aria-labelledby="contact-form-title"
    >
      <div className="mx-auto max-w-3xl">
        <p className="mono mb-4 text-xs text-dot-secondary">GET IN TOUCH</p>
        <h2
          id="contact-form-title"
          className="mb-4 text-3xl font-light text-dot-primary"
        >
          문의하기
        </h2>
        <p className="mb-12 text-sm leading-7 text-dot-secondary">
          궁금한 점이나 함께하고 싶은 이야기를 남겨주세요. 입력하신 이메일로
          답변드리겠습니다.
        </p>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          aria-busy={mutation.isPending}
        >
          <fieldset
            disabled={mutation.isPending}
            className="space-y-7 disabled:opacity-70"
          >
            <legend className="sr-only">문의 내용</legend>
            <div className="grid gap-7">
              <div>
                <label htmlFor="contact-name" className={LABEL_CLASS}>
                  성함{' '}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="contact-email" className={LABEL_CLASS}>
                  이메일{' '}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <fieldset>
              <legend className={LABEL_CLASS}>
                카테고리{' '}
                <span className="text-red-600" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                {CATEGORIES.map((category) => (
                  <label key={category}>
                    <input
                      type="radio"
                      name="category"
                      value={category}
                      required
                      className="peer sr-only"
                    />
                    <span className="block cursor-pointer rounded-full border border-[#d5d0c8] bg-white px-5 py-3 text-center text-sm text-dot-primary transition-colors hover:border-dot-primary peer-checked:border-dot-primary peer-checked:bg-dot-primary peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-dot-primary peer-disabled:cursor-wait">
                      {category}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="contact-subject" className={LABEL_CLASS}>
                제목{' '}
                <span className="text-red-600" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="contact-subject"
                name="subject"
                required
                maxLength={150}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="contact-message" className={LABEL_CLASS}>
                내용{' '}
                <span className="text-red-600" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                maxLength={5000}
                rows={7}
                className={cn(INPUT_CLASS, 'resize-y rounded-2xl')}
                aria-describedby="contact-message-help"
              />
              <p
                id="contact-message-help"
                className="mt-2 text-xs text-dot-secondary"
              >
                최대 5,000자까지 작성할 수 있습니다.
              </p>
            </div>
            <div>
              <label htmlFor="contact-attachment" className={LABEL_CLASS}>
                첨부파일 <span className="text-dot-secondary">(선택)</span>
              </label>
              <input
                ref={fileRef}
                id="contact-attachment"
                name="attachment"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileChange}
                className="block w-full rounded-md text-sm text-dot-secondary file:mr-4 file:cursor-pointer file:rounded-full file:border file:border-[#d5d0c8] file:bg-white file:px-5 file:py-3 file:text-dot-primary focus-visible:outline-2 focus-visible:outline-dot-primary"
                aria-describedby="contact-attachment-help contact-attachment-error"
                aria-invalid={!!fileError}
              />
              <p
                id="contact-attachment-help"
                className="mt-3 text-xs text-dot-secondary"
              >
                JPG, PNG, WEBP, PDF · 최대 1개, 5MB
              </p>
              {fileName && (
                <button
                  type="button"
                  className="mt-3 text-sm text-dot-secondary underline"
                  onClick={() => {
                    if (fileRef.current) fileRef.current.value = ''
                    setFileName('')
                    setFileError('')
                  }}
                >
                  첨부파일 삭제
                </button>
              )}
              <p
                id="contact-attachment-error"
                role="alert"
                className="mt-2 text-sm text-red-700"
              >
                {fileError}
              </p>
            </div>
            <div hidden aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <label className="flex items-start gap-3 text-sm leading-6 text-dot-secondary">
              <input
                name="privacyConsent"
                type="checkbox"
                value="true"
                required
                className="mt-1 size-4 shrink-0 accent-[#1a1a1a]"
              />
              <span>
                문의 처리를 위한 성함·이메일·문의 내용의 수집 및 이용에
                동의합니다. (필수){' '}
                <Link to="/privacy" className="underline">
                  개인정보 처리방침
                </Link>
              </span>
            </label>
            <div className="pt-3 text-center">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="rounded-full bg-dot-primary px-12 py-4 text-sm text-white transition-colors hover:bg-[#444] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-dot-primary disabled:cursor-wait disabled:opacity-60"
              >
                {mutation.isPending ? '전송 중…' : '문의 보내기'}
              </button>
            </div>
          </fieldset>
          <div
            className="mt-6 text-center text-sm leading-6"
            aria-live="polite"
            aria-atomic="true"
          >
            {mutation.isSuccess && (
              <p role="status" className="text-dot-primary">
                문의가 접수되었습니다. 입력하신 이메일로 답변드리겠습니다.
              </p>
            )}
            {(formError || mutation.error) && (
              <p role="alert" className="text-red-700">
                {formError ||
                  mutation.error?.message ||
                  '문의 전송에 실패했습니다. 다시 시도해 주세요.'}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}
