/** Normalize Bangla and Arabic-Indic decimal input; stored/exported values stay canonical. */
export function latinDigits(value: string): string {
  return value.replace(/[০-৯٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(
      code - (code >= 0x09e6 ? 0x09e6 : code >= 0x06f0 ? 0x06f0 : 0x0660),
    );
  });
}
