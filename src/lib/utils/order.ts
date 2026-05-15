import { CartItemInput } from '@/lib/types/order'

export function calculateItemSubtotal(price: number, qty: number) {
  return Number(price) * Number(qty)
}

export function calculateSubtotal(items: CartItemInput[]) {
  return items.reduce((sum, item) => {
    return sum + calculateItemSubtotal(item.price, item.qty)
  }, 0)
}

export function calculateOrderTotal(subtotal: number, shippingCost: number) {
  return Number(subtotal) + Number(shippingCost)
}

export function normalizePhoneNumber(phone: string) {
  const cleaned = phone.replace(/D/g, '')

  if (!cleaned) return ''
  if (cleaned.startsWith('0')) return `62${cleaned.slice(1)}`
  if (cleaned.startsWith('62')) return cleaned

  return cleaned
}