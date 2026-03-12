/**
 * @fileoverview Quote modal: local quote carousel, CSV import/export, per-quote rating slider.
 * @exports openQuoteModal, closeQuoteModal, navigateQuote
 * @reads/writes state.quotes, state.quoteIndex, state.quoteRatings
 */

const QUOTE_STORAGE_KEY = 'tj_quotes';
const QUOTE_INDEX_KEY = 'tj_quote_index';
const QUOTE_RATINGS_KEY = 'tj_quote_ratings';
const QUOTE_FONT_SIZE_KEY = 'tj_quote_font_size';
const DEFAULT_QUOTES = [
  {
    Quote: 'Market me sabse bada edge discipline hai, indicator nahi.',
    Source: 'Trading Journal',
    Tags: 'discipline,mindset',
    Date: '2026-03-12'
  },
  {
    Quote: 'Small loss ko accept karna easy hai, bada loss ko justify karna mehenga hai.',
    Source: 'Risk Rules',
    Tags: 'risk,loss-control',
    Date: '2026-03-12'
  },
  {
    Quote: 'Jo setup likh nahi sakte, us setup ko consistently trade bhi nahi kar sakte.',
    Source: 'Process First',
    Tags: 'setup,process',
    Date: '2026-03-12'
  }
];

function initializeQuotesFeature() {
  if (window.__quotesFeatureBound) return;
  window.__quotesFeatureBound = true;

  loadQuotesFromStorage();

  const modal = document.getElementById('quote-modal');
  const closeBtn = document.getElementById('quote-modal-close');
  const prevBtn = document.getElementById('quote-prev-btn');
  const nextBtn = document.getElementById('quote-next-btn');
  const slider = document.getElementById('quote-rating-slider');
  const uploadBtn = document.getElementById('quote-upload-btn');
  const downloadBtn = document.getElementById('quote-download-btn');
  const csvInput = document.getElementById('quote-csv-input');
  const fontMinusBtn = document.getElementById('quote-font-minus');
  const fontPlusBtn = document.getElementById('quote-font-plus');
  const randomLaunchBtn = document.getElementById('quote-random-launch-btn');
  const randomPanel = document.getElementById('quote-random-panel');
  const randomEnabled = document.getElementById('quote-random-enabled');
  const randomMinutes = document.getElementById('quote-random-minutes');
  const schedulerInlineBtn = document.getElementById('quote-scheduler-inline-btn');

  if (!modal) return;

  applyQuoteFontSize(loadQuoteFontSize());
  if (closeBtn) closeBtn.addEventListener('click', closeQuoteModal);
  if (prevBtn) prevBtn.addEventListener('click', () => navigateQuote(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateQuote(1));
  if (slider) {
    slider.addEventListener('input', () => {
      const current = getCurrentQuote();
      if (!current) return;
      state.quoteRatings[getQuoteKey(current)] = String(slider.value);
      saveQuoteRatings();
      updateQuoteRatingLabel();
    });
  }
  if (uploadBtn && csvInput) {
    uploadBtn.addEventListener('click', () => csvInput.click());
    csvInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (file) await importQuotesCsv(file);
      e.target.value = '';
    });
  }
  if (downloadBtn) downloadBtn.addEventListener('click', downloadQuotesCsv);
  if (fontMinusBtn) fontMinusBtn.addEventListener('click', () => adjustQuoteFontSize(-0.08));
  if (fontPlusBtn) fontPlusBtn.addEventListener('click', () => adjustQuoteFontSize(0.08));
  if (randomLaunchBtn && randomPanel) {
    randomLaunchBtn.addEventListener('click', e => {
      e.stopPropagation();
      randomPanel.classList.toggle('open');
    });
    randomPanel.addEventListener('click', e => e.stopPropagation());
  }
  if (schedulerInlineBtn && randomPanel) {
    schedulerInlineBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleQuoteAutoPopupFromButton();
    });
  }
  if (randomEnabled) {
    randomEnabled.checked = !!state.quoteAutoPopup.enabled;
    randomEnabled.addEventListener('change', () => {
      state.quoteAutoPopup.enabled = !!randomEnabled.checked;
      syncQuoteAutoPopup();
    });
  }
  if (randomMinutes) {
    randomMinutes.value = String(state.quoteAutoPopup.minMinutes || 15);
    randomMinutes.addEventListener('change', () => {
      const nextMinutes = Math.max(1, Math.min(180, parseInt(randomMinutes.value || '15', 10) || 15));
      state.quoteAutoPopup.minMinutes = nextMinutes;
      randomMinutes.value = String(nextMinutes);
      if (state.quoteAutoPopup.enabled) syncQuoteAutoPopup(true);
    });
  }
  modal.addEventListener('click', e => {
    if (e.target === modal) closeQuoteModal();
  });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateQuote(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateQuote(1);
    }
  });
  document.addEventListener('click', () => {
    if (randomPanel) randomPanel.classList.remove('open');
  });

  renderQuoteModal();
  syncQuoteAutoPopup();
}

function loadQuotesFromStorage() {
  try {
    const storedQuotes = JSON.parse(localStorage.getItem(QUOTE_STORAGE_KEY) || 'null');
    state.quotes = Array.isArray(storedQuotes) && storedQuotes.length
      ? storedQuotes.map(normalizeQuoteRow).filter(Boolean)
      : DEFAULT_QUOTES.map(normalizeQuoteRow).filter(Boolean);
  } catch (e) {
    state.quotes = DEFAULT_QUOTES.map(normalizeQuoteRow).filter(Boolean);
  }
  if (!state.quotes.length) state.quotes = DEFAULT_QUOTES.map(normalizeQuoteRow).filter(Boolean);

  try {
    state.quoteRatings = JSON.parse(localStorage.getItem(QUOTE_RATINGS_KEY) || '{}') || {};
  } catch (e) {
    state.quoteRatings = {};
  }

  const maxIndex = Math.max(0, state.quotes.length - 1);
  const savedIndex = parseInt(localStorage.getItem(QUOTE_INDEX_KEY) || '0', 10);
  state.quoteIndex = Number.isFinite(savedIndex) ? Math.min(maxIndex, Math.max(0, savedIndex)) : 0;
  saveQuotesToStorage();
}

function saveQuotesToStorage() {
  localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(state.quotes));
  localStorage.setItem(QUOTE_INDEX_KEY, String(state.quoteIndex || 0));
}

function saveQuoteRatings() {
  localStorage.setItem(QUOTE_RATINGS_KEY, JSON.stringify(state.quoteRatings || {}));
}

function normalizeQuoteRow(row) {
  if (!row || typeof row !== 'object') return null;
  const quote = String(row.Quote ?? row.quote ?? '').trim();
  if (!quote) return null;
  return {
    Quote: quote,
    Source: String(row.Source ?? row.source ?? '').trim() || 'Unknown',
    Tags: String(row.Tags ?? row.tags ?? '').trim() || '-',
    Date: String(row.Date ?? row.date ?? '').trim() || new Date().toISOString().slice(0, 10)
  };
}

function getQuoteKey(quote) {
  return `${quote.Date}|${quote.Source}|${quote.Quote}`;
}

function getCurrentQuote() {
  if (!Array.isArray(state.quotes) || !state.quotes.length) return null;
  state.quoteIndex = Math.max(0, Math.min(state.quoteIndex || 0, state.quotes.length - 1));
  return state.quotes[state.quoteIndex];
}

function openQuoteModal(randomize = false) {
  initializeQuotesFeature();
  const modal = document.getElementById('quote-modal');
  if (!modal) return;
  if (randomize && state.quotes.length > 1) {
    state.quoteIndex = Math.floor(Math.random() * state.quotes.length);
    saveQuotesToStorage();
  }
  renderQuoteModal();
  modal.classList.add('open');
}

function closeQuoteModal() {
  const modal = document.getElementById('quote-modal');
  if (modal) modal.classList.remove('open');
}

function navigateQuote(direction) {
  if (!state.quotes.length) return;
  const len = state.quotes.length;
  state.quoteIndex = (state.quoteIndex + direction + len) % len;
  saveQuotesToStorage();
  renderQuoteModal();
}

function renderQuoteModal() {
  const quote = getCurrentQuote();
  const textEl = document.getElementById('quote-text');
  const counterEl = document.getElementById('quote-modal-counter');
  const sliderEl = document.getElementById('quote-rating-slider');
  const prevBtn = document.getElementById('quote-prev-btn');
  const nextBtn = document.getElementById('quote-next-btn');
  const schedulerInlineBtn = document.getElementById('quote-scheduler-inline-btn');

  if (!textEl || !counterEl || !sliderEl) return;

  if (!quote) {
    textEl.textContent = 'No quotes available.';
    counterEl.textContent = '0 / 0';
    sliderEl.value = '5';
    updateQuoteRatingLabel();
    if (schedulerInlineBtn) schedulerInlineBtn.classList.toggle('active', !!state.quoteAutoPopup.enabled);
    return;
  }

  textEl.innerHTML = formatQuoteText(quote.Quote);
  counterEl.textContent = `${state.quoteIndex + 1} / ${state.quotes.length}`;
  sliderEl.value = state.quoteRatings[getQuoteKey(quote)] || '5';
  if (prevBtn) prevBtn.disabled = state.quotes.length <= 1;
  if (nextBtn) nextBtn.disabled = state.quotes.length <= 1;
  if (schedulerInlineBtn) {
    schedulerInlineBtn.classList.toggle('active', !!state.quoteAutoPopup.enabled);
    schedulerInlineBtn.textContent = state.quoteAutoPopup.enabled
      ? `Auto Popup On (${state.quoteAutoPopup.minMinutes}m+)`
      : 'Auto Popup';
  }
  updateQuoteRatingLabel();
}

function loadQuoteFontSize() {
  return parseFloat(localStorage.getItem(QUOTE_FONT_SIZE_KEY) || '1.42');
}

function applyQuoteFontSize(size) {
  const safe = Math.max(0.92, Math.min(2.4, parseFloat(size) || 1.42));
  document.documentElement.style.setProperty('--quote-font-size', `${safe}rem`);
  localStorage.setItem(QUOTE_FONT_SIZE_KEY, String(safe));
}

function adjustQuoteFontSize(step) {
  applyQuoteFontSize(loadQuoteFontSize() + step);
}

function updateQuoteRatingLabel() {
  const label = document.getElementById('quote-rating-value');
  const slider = document.getElementById('quote-rating-slider');
  if (label && slider) label.textContent = `${slider.value} / 10`;
}

async function importQuotesCsv(file) {
  const raw = await file.text();
  const rows = parseDelimitedRows(raw);
  if (rows.length < 2) {
    showToast('CSV me data nahi mila', 'error');
    return;
  }

  const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
  const quoteIdx = headers.indexOf('quote');
  const sourceIdx = headers.indexOf('source');
  const tagsIdx = headers.indexOf('tags');
  const dateIdx = headers.indexOf('date');

  if (quoteIdx === -1 || sourceIdx === -1 || tagsIdx === -1 || dateIdx === -1) {
    showToast('CSV headers: Quote, Source, Tags, Date hone chahiye', 'error');
    return;
  }

  const parsed = rows.slice(1)
    .map(cols => normalizeQuoteRow({
      Quote: cols[quoteIdx],
      Source: cols[sourceIdx],
      Tags: cols[tagsIdx],
      Date: cols[dateIdx]
    }))
    .filter(Boolean);

  if (!parsed.length) {
    showToast('Valid quote rows nahi mile', 'error');
    return;
  }

  const merged = [...state.quotes];
  let added = 0;
  parsed.forEach(item => {
    const key = getQuoteKey(item);
    if (!merged.some(existing => getQuoteKey(existing) === key)) {
      merged.push(item);
      added++;
    }
  });
  if (!added) {
    showToast('CSV se koi naya quote add nahi hua', 'error');
    return;
  }

  state.quotes = merged;
  state.quoteIndex = state.quotes.length - 1;
  saveQuotesToStorage();
  renderQuoteModal();
  showToast(`${added} naye quote add hue`, 'success');
}

function parseDelimitedRows(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  const firstLine = normalized.split('\n')[0] || '';
  if (!firstLine) return [];
  const delimiter = firstLine.includes('|') && !firstLine.includes(',') ? '|' : ',';
  if (normalized.includes('"') && normalized.includes('\n')) {
    return parseCsvText(normalized, delimiter);
  }
  const lines = normalized.split('\n').filter(line => line.trim());
  if (!lines.length) return [];
  return lines.map(line => parseDelimitedLine(line, delimiter));
}

function parseDelimitedLine(line, delimiter) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function downloadQuotesCsv() {
  const header = ['Quote', 'Source', 'Tags', 'Date'];
  const rows = state.quotes.map(quote => header.map(key => escapeCsvCell(quote[key] || '')));
  const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `quotes_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Quotes CSV download ready', 'success');
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function formatQuoteText(text) {
  const safe = escapeHtml(String(text ?? ''));
  return safe.replace(/,\s*/g, ',<br>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCsvText(text, delimiter) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if (ch === '\n' && !inQuotes) {
      row.push(current.trim());
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length || row.length) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows.filter(cols => cols.some(col => String(col || '').trim()));
}

function toggleQuoteAutoPopupFromButton() {
  const enabled = !state.quoteAutoPopup.enabled;
  if (enabled) {
    const current = state.quoteAutoPopup.minMinutes || 15;
    const answer = window.prompt('Minimum kitne minute baad random quote popup aaye?', String(current));
    if (answer === null) return;
    const nextMinutes = Math.max(1, Math.min(180, parseInt(answer || String(current), 10) || current));
    state.quoteAutoPopup.minMinutes = nextMinutes;
    state.quoteAutoPopup.enabled = true;
    showToast(`Auto popup on: minimum ${nextMinutes} min`, 'success');
  } else {
    state.quoteAutoPopup.enabled = false;
    showToast('Auto popup off', 'success');
  }
  syncQuoteAutoPopup(true);
  renderQuoteModal();
}

function syncQuoteAutoPopup(reset = false) {
  if (state.quoteAutoPopup.timerId) {
    clearTimeout(state.quoteAutoPopup.timerId);
    state.quoteAutoPopup.timerId = null;
  }
  const enabledInput = document.getElementById('quote-random-enabled');
  const minInput = document.getElementById('quote-random-minutes');
  if (enabledInput) enabledInput.checked = !!state.quoteAutoPopup.enabled;
  if (minInput) minInput.value = String(state.quoteAutoPopup.minMinutes || 15);
  if (!state.quoteAutoPopup.enabled || !state.quotes.length) return;
  scheduleNextQuotePopup(reset);
}

function scheduleNextQuotePopup() {
  const baseMinutes = Math.max(1, parseInt(state.quoteAutoPopup.minMinutes || 15, 10));
  const delayMinutes = baseMinutes + Math.random() * baseMinutes;
  const delayMs = Math.round(delayMinutes * 60 * 1000);
  state.quoteAutoPopup.timerId = window.setTimeout(() => {
    if (!document.getElementById('quote-modal')?.classList.contains('open')) {
      state.quoteIndex = Math.floor(Math.random() * state.quotes.length);
      saveQuotesToStorage();
      openQuoteModal(true);
      showToast(`Random quote popped after ${baseMinutes}+ min window`, 'success');
    }
    scheduleNextQuotePopup();
  }, delayMs);
}

initializeQuotesFeature();
