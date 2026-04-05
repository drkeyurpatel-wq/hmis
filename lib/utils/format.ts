/** Format number in Indian locale: 1,23,456 */
export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

/** Format as INR currency: ₹1,23,456 */
export function fmtINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** Format as compact INR: ₹1.2L or ₹1.5Cr */
export function fmtINRCompact(n: number): string {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
