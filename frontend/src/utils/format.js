export const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
export const fmtDateLong = (iso) => fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtNum = (n, d = 0) => (n == null ? '–' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (n, d = 0) => `${(n * 100).toFixed(d)}%`;
