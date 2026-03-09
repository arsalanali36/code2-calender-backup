/**
 * @fileoverview tradeService.js
 * @description All /api/trades operations.
 *   Components/modules call these instead of fetch('/api/trades') directly.
 */

const tradeService = (() => {
  /**
   * Load the full journal payload from the server.
   * @returns {Promise<{trades: Array, columns: Array, dayData: object}>}
   */
  async function loadTrades() {
    return apiClient.get('/api/trades');
  }

  /**
   * Persist the full journal payload to the server.
   * @param {{trades: Array, columns: Array, dayData: object}} payload
   */
  async function saveTrades(payload) {
    return apiClient.post('/api/trades', payload);
  }

  return { loadTrades, saveTrades };
})();
