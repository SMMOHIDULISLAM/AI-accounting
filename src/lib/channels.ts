/** Opening a review link does not send a message. No channel credentials are embedded. */
export function channelShareUrl(
  channel: "telegram" | "email",
  message: string,
  recipient = "",
): string {
  if (!message.trim() || message.length > 4000)
    throw Error("Keep the message within 4,000 characters.");
  if (channel === "telegram")
    return (
      "https://t.me/share/url?url=" +
      encodeURIComponent("https://github.com/SMMOHIDULISLAM/AI-accounting") +
      "&text=" +
      encodeURIComponent(message)
    );
  const email = recipient.trim();
  if (email && !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email))
    throw Error("Enter a valid email address");
  return (
    "mailto:" +
    encodeURIComponent(email) +
    "?subject=" +
    encodeURIComponent("AI Accounting - management report") +
    "&body=" +
    encodeURIComponent(message)
  );
}
export function sponsorLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
