/**
 * @fileoverview exportService.js
 * @description All data-export and backup API operations.
 *   Each function fetches a Blob and triggers a browser download.
 */

const exportService = (() => {
  /** Trigger a file download in the browser from a Blob. */
  function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function _timestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, (c) =>
      c === 'T' ? '_' : c
    );
  }

  /**
   * Export trades as Excel (.xlsx).
   * @param {{trades: Array, columns: Array}} payload
   */
  async function exportExcel(payload) {
    const blob = await apiClient.download('/api/export-excel', payload);
    _triggerDownload(blob, `trading_journal_${_timestamp()}.xlsx`);
  }

  /**
   * Export trades as structured CSV.
   * @param {{trades: Array, columns: Array}} payload
   */
  async function exportStructuredCsv(payload) {
    const blob = await apiClient.download('/api/export-structured-csv', payload);
    _triggerDownload(blob, 'structured_trades.csv');
  }

  /**
   * Export trades as trade-logger Excel (two sheets).
   * @param {{trades: Array}} payload
   */
  async function exportLoggerExcel(payload) {
    const blob = await apiClient.download('/api/export-logger-excel', payload);
    _triggerDownload(blob, `trade_logger_export_${_timestamp()}.xlsx`);
  }

  /**
   * Download a full backup ZIP (trades.json + images + Excel + observations HTML).
   * @param {string} [name] - optional custom filename prefix
   */
  async function downloadBackup(name = '') {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    const blob = await apiClient.downloadGet(`/api/backup${query}`);
    _triggerDownload(blob, name ? `${name}.zip` : `trading_journal_${_timestamp()}.zip`);
  }

  return { exportExcel, exportStructuredCsv, exportLoggerExcel, downloadBackup };
})();
