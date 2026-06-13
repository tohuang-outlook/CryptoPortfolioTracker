export function PriceStatus({
  status,
  lastUpdated
}: {
  status: "idle" | "loading" | "ready" | "error";
  lastUpdated: string | null;
}) {
  if (status === "loading") {
    return <p>Loading live prices...</p>;
  }

  if (status === "error") {
    return <p>Live prices are temporarily unavailable.</p>;
  }

  if (status === "ready" && lastUpdated) {
    return <p>Live prices updated.</p>;
  }

  return <p>Waiting for live prices.</p>;
}
