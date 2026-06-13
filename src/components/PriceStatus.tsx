export function PriceStatus({
  status,
  lastUpdated
}: {
  status: "idle" | "loading" | "ready" | "error";
  lastUpdated: string | null;
}) {
  if (status === "loading") {
    return (
      <p role="status" aria-live="polite" aria-atomic="true">
        Loading live prices...
      </p>
    );
  }

  if (status === "error") {
    return (
      <p role="alert" aria-live="assertive" aria-atomic="true">
        Live prices are temporarily unavailable.
      </p>
    );
  }

  if (status === "ready" && lastUpdated) {
    return (
      <p role="status" aria-live="polite" aria-atomic="true">
        Live prices updated.
      </p>
    );
  }

  return (
    <p role="status" aria-live="polite" aria-atomic="true">
      Waiting for live prices.
    </p>
  );
}
