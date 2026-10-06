import api from '../services/api';

/**
 * Downloads an official fee receipt PDF directly to the user's device.
 * Automatically leverages api instance baseURL, auth tokens, and triggers a clean browser download.
 *
 * @param {string} feeId - Fee record ID
 * @param {string} label - Term / month or student identifier for filename
 */
export async function downloadReceiptPDF(feeId, label = '') {
  try {
    const res = await api.get(`/fees/receipt/${feeId}?download=true`, {
      responseType: 'blob',
    });

    // Check if the response was actually JSON error returned with 200 or as blob
    if (res.data.type === 'application/json') {
      const text = await res.data.text();
      const json = JSON.parse(text);
      throw new Error(json.message || 'Unable to generate receipt PDF.');
    }

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const safeLabel = String(label || 'Tuition_Fee')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    const filename = `Sri_Ruthralaya_Receipt_${safeLabel}_${String(feeId).slice(0, 8)}.pdf`;

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('Receipt PDF download error:', err);
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.message || 'Unable to download receipt PDF.');
      } catch (parseErr) {
        if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
      }
    }
    throw err;
  }
}
