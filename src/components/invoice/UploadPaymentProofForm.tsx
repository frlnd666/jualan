'use client'

import { useState, useTransition } from 'react'
import { uploadPaymentProof } from '@/lib/actions/upload-payment-proof'

/**
 * Kecilkan foto bukti di browser sebelum dikirim: foto kamera HP umumnya
 * 2–6MB, lambat diunggah lewat server action dan rawan gagal di jaringan
 * seluler. Bukti transfer cukup terbaca jelas di sisi panjang maks 1600px
 * JPEG — hasilnya biasanya < 400KB. Bila kompresi gagal/tidak didukung,
 * file asli yang dikirim (server tetap memvalidasi maks 3MB).
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 900 * 1024) return file

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions)
    const maxSide = 1600
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

type Props = {
  invoiceId: string
  invoiceNumber: string
  paymentProofUrl: string | null
  accessToken?: string
}

export default function UploadPaymentProofForm({
  invoiceId,
  invoiceNumber,
  paymentProofUrl,
  accessToken = '',
}: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      {paymentProofUrl ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">
            Bukti transfer sudah diupload
          </p>
          <p className="mt-1 text-sm text-green-700">
            Seller akan memverifikasi pembayaranmu dari bukti tersebut.
          </p>
        </div>
      ) : null}

      <form
        action={(formData) => {
          setMessage(null)
          startTransition(async () => {
            const rawFile = formData.get('file')
            if (rawFile instanceof File && rawFile.size > 0) {
              formData.set('file', await compressImageIfNeeded(rawFile))
            }
            const result = await uploadPaymentProof(formData)
            setMessage(result.error || result.success || null)
          })
        }}
        className="space-y-3"
      >
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="invoiceNumber" value={invoiceNumber} />
        <input type="hidden" name="accessToken" value={accessToken} />

        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700">
            Upload bukti transfer
          </label>
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700"
            required={!paymentProofUrl}
          />
          <p className="mt-2 text-xs text-neutral-500">
            Format: JPG, PNG, atau WEBP. Maksimal 3MB.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="block w-full rounded-2xl bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isPending ? 'Mengupload...' : 'Upload bukti transfer'}
        </button>

        {message ? (
          <p className="text-sm text-neutral-700">{message}</p>
        ) : null}
      </form>
    </div>
  )
}