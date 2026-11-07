import type { OrderStep } from '@/lib/order-status'

/**
 * Timeline vertikal perjalanan pesanan (pengganti halaman /track terpisah).
 * Langkah selesai = centang hijau, langkah aktif = titik indigo berdenyut
 * halus, sisanya abu.
 */
export default function OrderTimeline({ steps }: { steps: OrderStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 h-[calc(100%-24px)] w-0.5 ${
                  step.done ? 'bg-emerald-500' : 'bg-neutral-200'
                }`}
              />
            ) : null}
            <span
              aria-hidden
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? 'bg-emerald-500 text-white'
                  : step.active
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                    : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {step.done ? '✓' : index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={`text-sm font-semibold ${
                  step.done || step.active
                    ? 'text-neutral-900'
                    : 'text-neutral-500'
                }`}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                {step.description}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
