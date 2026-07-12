// Uploads directly from the browser to Cloudinary using an unsigned upload
// preset — no server-side secret needed, works on Cloudinary's free tier.
// Requires VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.
export async function uploadToCloudinary(file, resourceType = "video") {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Video upload isn't set up yet — missing Cloudinary config.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || "Video upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}
