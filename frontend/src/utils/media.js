/**
 * Sri Ruthralaya Bharathanatyam Academy - Media & Upload Utilities
 */

/**
 * Resolves any image URL to a valid, displayable source.
 * Handles data URLs, full HTTP(S) links, backend /uploads paths, and static academy assets.
 */
export function getMediaUrl(url, fallback = '/BG1.png') {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();
  if (!trimmed) return fallback;

  // Data URLs, Blobs, or external CDN/HTTP(S) links
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // Backend /uploads directory
  if (trimmed.startsWith('/uploads')) {
    const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
    if (rawApiBase.startsWith('http://') || rawApiBase.startsWith('https://')) {
      try {
        const origin = new URL(rawApiBase).origin;
        return `${origin}${trimmed}`;
      } catch (e) {
        // Fall through to relative
      }
    }
    return trimmed;
  }

  // Relative public asset (e.g. /BG1.png, /logo.png)
  return trimmed;
}

/**
 * Optimizes an image file from device input (up to 15MB).
 * Resizes large dimensions (max 1920px) and compresses to high-quality JPEG (0.88),
 * drastically reducing upload time and database payload while retaining stunning clarity.
 *
 * @param {File} file - Image file from file input
 * @param {number} maxDimension - Maximum width or height in pixels (default: 1920)
 * @param {number} quality - JPEG compression quality 0.1 to 1.0 (default: 0.88)
 * @returns {Promise<string>} Resolves to Base64 data URL
 */
export function optimizeImageFile(file, maxDimension = 1920, quality = 0.88) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided'));
    }

    // Pass SVGs directly without rasterizing
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        // Fallback to uncompressed data URL if canvas cannot parse
        resolve(e.target.result);
      };
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down proportionally if larger than maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(e.target.result);
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Use image/jpeg for broad compatibility and high compression ratio
          const format = file.type === 'image/png' && file.size < 500 * 1024 ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(format, quality);
          resolve(dataUrl);
        } catch (err) {
          // If anything fails in canvas, fallback to raw reader result
          resolve(e.target.result);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
