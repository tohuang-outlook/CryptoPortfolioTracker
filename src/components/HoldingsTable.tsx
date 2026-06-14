import type { AssetSummary } from "../types/portfolio";

const HOLDING_DOT_COLORS = [
  "#1f6f78",
  "#4f9d8c",
  "#8fb996",
  "#d2b48c",
  "#d9845f",
  "#9b6a6c"
] as const;

export function HoldingsTable({ assets }: { assets: AssetSummary[] }) {
  return (
    <section className="panel" aria-labelledby="holdings-heading">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Current positions</p>
          <h2 id="holdings-heading">Holdings</h2>
        </div>
      </div>

      <div className="table-scroll">
        <table className="holdings-table">
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col">Quantity</th>
              <th scope="col">Invested</th>
              <th scope="col">Value</th>
              <th scope="col">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, index) => (
              <tr key={asset.assetSymbol}>
                <th scope="row">
                  <div className="asset-cell">
                    <span
                      className="asset-cell__dot"
                      style={{
                        backgroundColor:
                          HOLDING_DOT_COLORS[index % HOLDING_DOT_COLORS.length]
                      }}
                      aria-hidden="true"
                    />
                    <div className="asset-cell__content">
                      <span className="asset-cell__symbol">{asset.assetSymbol}</span>
                      <span className="asset-cell__name">
                        {asset.assetName} · {formatPercent(asset.allocationPercent)}
                      </span>
                    </div>
                  </div>
                </th>
                <td>{asset.totalQuantity.toFixed(8)}</td>
                <td>{formatCurrency(asset.totalInvested)}</td>
                <td>{formatCurrency(asset.currentValue)}</td>
                <td
                  className={
                    asset.unrealizedPnL >= 0 ? "value-positive" : "value-negative"
                  }
                >
                  {formatSignedCurrency(asset.unrealizedPnL)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formattedValue = formatCurrency(Math.abs(value));
  return value >= 0 ? `+${formattedValue}` : `-${formattedValue}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
