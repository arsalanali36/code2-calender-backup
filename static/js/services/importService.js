/**
 * @fileoverview importService.js
 * @description All data-import API operations: Excel, CSV variants, JSON/ZIP restore.
 *   Returns normalized {trades, columns} payloads.
 */

const importService = (() => {
  function _formDataFromFile(file, fieldName = 'file') {
    const fd = new FormData();
    fd.append(fieldName, file);
    return fd;
  }

  /**
   * Import trades from an Excel (.xlsx) file.
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importExcel(file) {
    return apiClient.upload('/api/import-excel', _formDataFromFile(file));
  }

  /**
   * Import trades from a Zerodha raw-fills CSV (today's trades).
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importRawCsv(file) {
    return apiClient.upload('/api/import-raw-csv', _formDataFromFile(file));
  }

  /**
   * Import trades from a Zerodha historical CSV.
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importHistoricalCsv(file) {
    return apiClient.upload('/api/import-historical-csv', _formDataFromFile(file));
  }

  /**
   * Import trades from a Dhan CSV.
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importDhanCsv(file) {
    return apiClient.upload('/api/import-dhan-csv', _formDataFromFile(file));
  }

  /**
   * Restore journal from a JSON or ZIP backup.
   * @param {File} file
   * @returns {Promise<{success: boolean, trades: Array, columns: Array}>}
   */
  async function importJsonOrZip(file) {
    return apiClient.upload('/api/import-json', _formDataFromFile(file));
  }

  return {
    importExcel,
    importRawCsv,
    importHistoricalCsv,
    importDhanCsv,
    importJsonOrZip,
  };
})();
