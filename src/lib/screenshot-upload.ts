import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

/** Fast client-side feedback only; the server repeats MIME, size, and signature checks. */
export function screenshotFileError(file: { size: number; type: string }) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Only JPEG, PNG, WebP, and GIF images are allowed";
  if (file.size === 0) return "The image is empty";
  if (file.size > MAX_UPLOAD_BYTES) return "The image must be 4 MB or smaller";
  return null;
}
