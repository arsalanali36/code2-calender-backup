/**
 * @fileoverview csvlogService.js
 * @description API calls for CSVLog schema — fetch and upload.
 */

const csvlogService = (() => {

  /**
   * Fetch the current parsed schema from the server.
   * @returns {Promise<{groups: string[], fields: Object}|null>}
   */
  async function getSchema() {
    try {
      return await apiClient.get('/api/csvlog-schema');
    } catch (e) {
      return null;
    }
  }

  /**
   * Upload a new LOGGER.xlsx file to replace the schema.
   * @param {File} file
   * @returns {Promise<{ok: boolean, schema: Object}>}
   */
  async function uploadSchema(file) {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.upload('/api/csvlog-upload-schema', fd);
  }

  return { getSchema, uploadSchema };
})();
