export function generateInvoiceNumber(sequence: number) {
  const year = new Date().getFullYear()
  return `INV-${year}-${String(sequence).padStart(4, '0')}`
}