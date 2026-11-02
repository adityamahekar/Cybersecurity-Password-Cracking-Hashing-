const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

export function formatBig(n) {
  if (n == null || !isFinite(n)) return '∞';
  if (n < 1000) return String(Math.round(n));
  if (n < 1e4) return Math.round(n).toLocaleString('en-IN');
  const exp = Math.floor(Math.log10(n));
  const mant = n / Math.pow(10, exp);
  const sup = String(exp).split('').map((d) => SUPERSCRIPT[Number(d)]).join('');
  return `${mant.toFixed(2)} × 10${sup}`;
}

export function formatCount(n) {
  if (n == null || !isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-IN');
}

export function formatRate(hps) {
  if (hps == null || !isFinite(hps)) return '—';
  if (hps >= 1e9) return `${(hps / 1e9).toFixed(2)} GH/s`;
  if (hps >= 1e6) return `${(hps / 1e6).toFixed(2)} MH/s`;
  if (hps >= 1e3) return `${(hps / 1e3).toFixed(1)} kH/s`;
  return `${Math.round(hps)} H/s`;
}

export function formatSeconds(s) {
  if (s == null || !isFinite(s)) return '—';
  if (s < 0.001) return '<1 ms';
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  if (s < 60) return `${s.toFixed(2)} s`;
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(0);
  return `${m}m ${rest}s`;
}
