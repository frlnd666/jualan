// Diagnostik sementara (2026-11-09): server action seller di halaman
// detail order menggantung — tombol "Menyimpan..." tertahan >25 detik tanpa
// respons, dan "Konfirmasi pembayaran" malah menampilkan halaman error
// server. Penyebabnya belum ketahuan dari baca kode (semua jalur sudah
// dijaga return {error}) dan log server Vercel tidak bisa dibaca dari sini
// (403), jadi aksi diinstrumentasi: tiap langkah dicatat, dan bila ada
// langkah yang menggantung lebih dari batas, aksi mengembalikan pesan
// diagnostik "berhenti di langkah X setelah N ms" agar terlihat dari UI.
//
// HAPUS file ini beserta pemakaiannya setelah akar masalah ketemu dan
// diperbaiki — ini bukan pertahanan permanen, hanya alat diagnosis.

export interface StepTracker {
  step: string
  startedAt: number
  set(step: string): void
  elapsedMs(): number
}

export function createStepTracker(): StepTracker {
  const startedAt = Date.now()
  let step = 'mulai'
  return {
    get step() {
      return step
    },
    startedAt,
    set(next: string) {
      step = next
    },
    elapsedMs() {
      return Date.now() - startedAt
    },
  }
}

/**
 * Balapan sebuah promise melawan batas waktu. Bila promise tidak selesai
 * dalam `ms`, tolak dengan pesan yang menyebut langkah terakhir yang
 * tercatat — supaya dari UI ketahuan langkah mana yang menggantung.
 * Promise yang kalah balapan tetap berjalan di latar (tidak dibatalkan);
 * pemanggil yang memakai ini harus sadar tulisannya mungkin tetap jalan.
 */
export async function withActionTimeout<T>(
  promise: Promise<T>,
  ms: number,
  tracker: StepTracker
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Timeout ${ms}ms di langkah "${tracker.step}" (total ${tracker.elapsedMs()}ms)`
              )
            ),
          ms
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Batas diagnosis: panggilan Supabase normal selesai <1 detik. */
export const DIAGNOSTIC_TIMEOUT_MS = 8000
