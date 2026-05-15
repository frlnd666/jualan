'use client'

import { useState, useTransition } from 'react'
import { uploadPaymentProof } from '@/lib/actions/upload-payment-proof'

type Props = {
  invoiceId: string
  invoiceNumber: string
  paymentProofUrl: string | null
}

export default function UploadPaymentProofForm({
  invoiceId,
  invoiceNumber,
  paymentProofUrl,
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
          <a
            href={paymentProofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-green-700 underline"
          >
            Lihat bukti transfer
          </a>
        </div>
      ) : null}

      <form
        action={(formData) => {
          setMessage(null)
          startTransition(async () => {
            const result = await uploadPaymentProof(formData)
            setMessage(result.error || result.success || null)
          })
        }}
        className="space-y-3"
      >
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="invoiceNumber" value={invoiceNumber} />

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