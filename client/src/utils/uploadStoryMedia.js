import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

// Uploads a story image/video to Firebase Storage under stories/{uid}/{timestamp}-{filename}
// and returns the public download URL to save alongside the story doc.
export async function uploadStoryMedia(uid, file) {
  const path = `stories/${uid}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
