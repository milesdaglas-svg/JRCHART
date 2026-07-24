// No Firebase Storage bucket needed (that requires a linked billing card).
// Instead, we shrink the photo client-side and store it as a compact base64
// string directly in the Firestore story document. Firestore documents cap
// out at 1MB, so we resize + compress aggressively to stay well under that.

const MAX_DIMENSION = 700; // px, longest side
const JPEG_QUALITY = 0.55;
const MAX_BASE64_CHARS = 700_000; // leaves headroom under Firestore's 1MB doc limit

export function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

        if (dataUrl.length > MAX_BASE64_CHARS) {
          reject(new Error("That photo is still too large after compression — try a smaller one."));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Couldn't read that image file."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}
