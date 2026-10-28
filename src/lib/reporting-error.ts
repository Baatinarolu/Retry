export function isFxReportingError(message: string) {
  return /\bFX\b|cross-currency/i.test(message);
}
