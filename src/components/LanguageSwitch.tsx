import { useLanguage } from "../lib/i18n";

export default function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <label className="language-switch">
      <span className="sr-only">ভাষা / Language</span>
      <select
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value === "en" ? "en" : "bn")
        }
      >
        <option value="bn">বাংলা</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
