'use client'

import { useState, useTransition } from 'react'
import { confirmPayment } from '@/lib/actions/confirm-payment'

type Props = {
  invoiceId: string
  orderId: string
  invoiceNumber: string
  disabled?: boolean
}

export default function ConfirmPaymentButton({
  invoiceId,
  orderId,
  invoiceNumber,
  disabled = false,
}: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-2">
      <form
        action={(formData) => {
          setMessage(null)
          startTransition(async () => {
            const result = await confirmPayment(formData)
            setMessage(result.error || result.success || null)
          })
        }}
      >
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="invoiceNumber" value={invoiceNumber} />

        <button
          type="submit"
          disabled={disabled || isPending}
          className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isPending ? 'Menyimpan...' : 'Konfirmasi pembayaran'}
        </button>
      </form>

      {message ? (
        <p className="text-xs text-neutral-600">{message}</p>
      ) : null}
    </div>
  )
}