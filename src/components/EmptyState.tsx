import { useTranslation } from "../i18n";

export function EmptyState() {
  const { t } = useTranslation();
  return (
    <section className="panel empty-state">
      <p className="panel__eyebrow">{t("Dashboard waiting")}</p>
      <h2>{t("Add your first crypto buy")}</h2>
      <p>
        {t("Start with one transaction and your holdings, allocation, and history will appear automatically.")}
      </p>
    </section>
  );
}
