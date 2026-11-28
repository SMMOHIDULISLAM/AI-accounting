import { sponsorLink } from "../lib/channels";
import { t, useLanguage } from "../lib/i18n";
export default function SponsorCard() {
  useLanguage();
  const href = sponsorLink(import.meta.env.VITE_SPONSOR_URL),
    name = import.meta.env.VITE_SPONSOR_NAME;
  if (!href || !name) return null;
  return (
    <aside className="panel padded">
      <small>{t("Sponsored")}</small>
      <strong>{name}</strong>
      <p>
        {t(
          "This optional sponsor card does not load advertising scripts or share your accounting records.",
        )}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        referrerPolicy="no-referrer"
      >
        {t("Visit sponsor")}
      </a>
    </aside>
  );
}
