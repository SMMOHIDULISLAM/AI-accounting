import { describe, expect, it } from "vitest";
import { channelShareUrl, sponsorLink } from "../src/lib/channels";
describe("reviewed report sharing and sponsor links", () => {
  it("preserves Bangla and special characters in Telegram and email previews", () => {
    const message = "বিক্রয় ১৫০\nA&B + #?";
    expect(
      new URL(channelShareUrl("telegram", message)).searchParams.get("text"),
    ).toBe(message);
    expect(
      new URL(
        channelShareUrl("email", message, "owner@example.com"),
      ).searchParams.get("body"),
    ).toBe(message);
  });
  it("rejects injected email headers and unreasonable previews", () => {
    expect(() =>
      channelShareUrl(
        "email",
        "report",
        "x@example.com\r\nBcc:other@example.com",
      ),
    ).toThrow();
    expect(() => channelShareUrl("telegram", "x".repeat(4001))).toThrow();
  });
  it("enables only valid HTTPS sponsor links without credentials", () => {
    expect(sponsorLink("javascript:alert(1)")).toBeUndefined();
    expect(sponsorLink("https://a:b@example.com")).toBeUndefined();
    expect(sponsorLink(undefined)).toBeUndefined();
    expect(sponsorLink("https://example.com/sponsor")).toBe(
      "https://example.com/sponsor",
    );
  });
});
