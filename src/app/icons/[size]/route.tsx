import { ImageResponse } from 'next/og'

/**
 * Ikon PWA digenerate dari kode (tidak ada aset PNG biner di repo):
 * kotak hijau zamrud dengan huruf C putih. Ukuran yang didukung: 192 dan 512.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params
  const px = size === '512' ? 512 : 192

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b6b4a',
          borderRadius: px * 0.22,
          color: '#ffffff',
          fontSize: px * 0.58,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        C
      </div>
    ),
    { width: px, height: px }
  )
}
