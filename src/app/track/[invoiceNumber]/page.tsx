export default function TrackPage({ params }: { params: { invoiceNumber: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-4 space-y-3">
        <h1 className="text-xl font-bold text-gray-900">Track Order</h1>
        <p className="text-sm text-gray-500">No invoice: {params.invoiceNumber}</p>
        <p className="text-sm text-gray-500">Timeline order akan ditampilkan dari database berikutnya.</p>
      </div>
    </div>
  )
}