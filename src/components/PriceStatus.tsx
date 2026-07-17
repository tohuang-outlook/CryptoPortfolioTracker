export function PriceStatus({
  status,
  lastUpdated
}: {
  status: "idle" | "loading" | "ready" | "error";
  lastUpdated: string | null;
}) {
  const { language, t } = useTranslation();
  if (status === "loading") {
    return (
      <div
        className="price-status price-status--loading"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="price-status__headline">{t("Loading live prices...")}</p>
        <p className="price-status__detail">
          {t("Checking the latest market prices now.")}
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="price-status price-status--error"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <p className="price-status__headline">
          {t("Live prices are temporarily unavailable.")}
        </p>
        <p className="price-status__detail">
          {lastUpdated
            ? `${t("Showing the last successful update from")} ${formatLastUpdated(lastUpdated, language)}.`
            : t("We will try again automatically in about a minute.")}
        </p>
      </div>
    );
  }

  if (status === "ready" && lastUpdated) {
    return (
      <div
        className="price-status price-status--ready"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="price-status__headline">{t("Live prices updated.")}</p>
        <p className="price-status__detail">
          {t("Updated")} {formatLastUpdated(lastUpdated, language)}.
        </p>
      </div>
    );
  }

  return (
    <div
      className="price-status price-status--idle"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="price-status__headline">{t("Waiting for live prices.")}</p>
      <p className="price-status__detail">
        {t("Prices will appear here after the first refresh completes.")}
      </p>
    </div>
  );
}

function formatLastUpdated(value: string, language: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return language === "zh-TW" ? "剛剛" : "recently";
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const locale = language === "zh-TW" ? "zh-TW" : undefined;
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);

  if (sameDay) {
    return language === "zh-TW" ? `今天 ${timeLabel}` : `today at ${timeLabel}`;
  }

  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric"
  }).format(date);

  return language === "zh-TW" ? `${dateLabel} ${timeLabel}` : `${dateLabel} at ${timeLabel}`;
}
import { useTranslation } from "../i18n";
