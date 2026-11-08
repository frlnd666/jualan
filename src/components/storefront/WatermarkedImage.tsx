// Gambar produk dengan watermark platform (Fase 4).
// Dipakai storefront paket Free: foto tampil dengan watermark "CUAN"
// (versi display saja — file asli di storage TIDAK diubah).
// Overlay CSS murni, tanpa dependensi image-processing.

export default function WatermarkedImage({
  src,
  alt,
  className,
  watermarked,
}: {
  src: string
  alt: string
  className?: string
  /** false = tampilkan foto polos (Silver/Gold). */
  watermarked: boolean
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img src={src} alt={alt} className={className} />
      {watermarked ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          <span className="rotate-[-18deg] whitespace-nowrap text-2xl font-black uppercase tracking-[0.3em] text-white/45 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] select-none">
            CUAN
          </span>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
            CUAN
          </span>
        </div>
      ) : null}
    </div>
  )
}
