// Uploads directly from the browser to Cloudinary using an unsigned upload
// preset — no server-side secret needed, works on Cloudinary's free tier.
// Requires VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.
//
// Uses XMLHttpRequest instead of fetch specifically so we can report real
// upload progress (fetch has no upload-progress event) — needed for an
// Instagram-style "Uploading… 42%" indicator on video posts.
export function uploadToCloudinary(file, resourceType = "video", onProgress) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return Promise.reject(new Error("Video upload isn't set up yet — missing Cloudinary config."));
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            url: data.secure_url,
            thumbnailUrl: resourceType === "video" ? toVideoThumbnail(data.secure_url) : null,
            durationSeconds: data.duration || null,
          });
        } else {
          reject(new Error(data.error?.message || "Upload failed"));
        }
      } catch {
        reject(new Error("Upload failed — couldn't read the response"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(formData);
  });
}

function toVideoThumbnail(videoUrl) {
  try {
    const withFrame = videoUrl.replace("/upload/", "/upload/so_0/");
    return withFrame.replace(/\.(mp4|mov|webm|mkv)$/i, ".jpg");
  } catch {
    return null;
  }
}