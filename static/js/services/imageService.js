/**
 * @fileoverview imageService.js
 * @description All image-related API operations:
 *   upload, delete (to server trash), fetch timestamps, copy to clipboard.
 */

const imageService = (() => {
  /**
   * Upload a single image File object to the server.
   * @param {File} file
   * @param {number} [quality] - Optional compression quality (0-1)
   * @returns {Promise<{url: string, filename: string, originalSize: number, compressedSize: number}>}
   */
  async function uploadImage(file, quality) {
    let fileToUpload = file;
    let originalSize = file.size;
    let compressedSize = file.size;

    if (quality && quality < 1 && file.type.startsWith('image/')) {
        try {
            fileToUpload = await compressImage(file, quality);
            compressedSize = fileToUpload.size;
            console.log(`[Compression] q=${quality}, ${originalSize} -> ${compressedSize} bytes`);
        } catch (e) {
            console.warn("Compression failed, uploading original:", e);
        }
    }
    const fd = new FormData();
    fd.append('image', fileToUpload);
    if (file.lastModified) fd.append('last_modified_ms', String(file.lastModified));
    if (file.name) fd.append('original_filename', file.name);
    const result = await apiClient.upload('/api/upload-image', fd);
    return { ...result, originalSize, compressedSize };
  }

  /**
   * Compress image using canvas
   * @param {File} file
   * @param {number} quality
   * @returns {Promise<File>}
   */
  async function compressImage(file, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Canvas blob failed'));
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const newFile = new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(newFile);
          }, 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Move an image to the server-side trash (soft delete).
   * @param {string} imageUrl - e.g. '/uploads/abc123.png'
   */
  async function deleteImage(imageUrl) {
    const filename = imageUrl.split('/').pop();
    return apiClient.post('/api/delete-image', { filename });
  }

  /**
   * Fetch formatted creation times for a list of image URLs.
   * @param {string[]} urls
   * @returns {Promise<Record<string, string>>}  url → 'HH:MM AM/PM'
   */
  async function getImageTimes(urls) {
    if (!urls || !urls.length) return {};
    return apiClient.post('/api/image-times', { urls });
  }

  /**
   * Copy an image to the OS clipboard (Windows only, server-side).
   * @param {string} imageUrl - e.g. '/uploads/abc123.png'
   */
  async function copyToClipboard(imageUrl) {
    const filename = imageUrl.split('/').pop();
    return apiClient.post('/api/copy-image-to-clipboard', { filename });
  }

  async function uploadAudio(blob) {
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');
    return apiClient.upload('/api/upload-audio', fd);
  }

  async function deleteAudio(audioUrl) {
    return apiClient.post('/api/delete-audio', { url: audioUrl });
  }

  async function uploadVideo(blob) {
    const fd = new FormData();
    fd.append('video', blob, 'recording.webm');
    return apiClient.upload('/api/upload-video', fd);
  }

  async function deleteVideo(videoUrl) {
    return apiClient.post('/api/delete-video', { url: videoUrl });
  }

  return { uploadImage, deleteImage, getImageTimes, copyToClipboard, uploadAudio, deleteAudio, uploadVideo, deleteVideo };
})();
