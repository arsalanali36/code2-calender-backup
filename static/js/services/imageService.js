/**
 * @fileoverview imageService.js
 * @description All image-related API operations:
 *   upload, delete (to server trash), fetch timestamps, copy to clipboard.
 */

const imageService = (() => {
  /**
   * Upload a single image File object to the server.
   * @param {File} file
   * @returns {Promise<{url: string, filename: string}>}
   */
  async function uploadImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    if (file.lastModified) fd.append('last_modified_ms', String(file.lastModified));
    if (file.name) fd.append('original_filename', file.name);
    return apiClient.upload('/api/upload-image', fd);
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

  return { uploadImage, deleteImage, getImageTimes, copyToClipboard };
})();
