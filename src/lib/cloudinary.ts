export async function uploadToCloudinary(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_PRESET!)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message || 'Upload gagal')
  }

  return data.secure_url as string
}