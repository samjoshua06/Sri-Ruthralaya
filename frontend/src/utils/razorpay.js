const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Resolves with window.Razorpay. The script is included in index.html;
 * this injects it on demand if it hasn't loaded yet (or was blocked once).
 */
export function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);

    let script = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    const timeout = setTimeout(() => reject(new Error('Razorpay checkout took too long to load.')), 15000);
    script.addEventListener('load', () => {
      clearTimeout(timeout);
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay checkout failed to initialise.'));
    });
    script.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('Unable to load Razorpay checkout. Check your internet connection or disable ad-blockers.'));
    });
  });
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;
