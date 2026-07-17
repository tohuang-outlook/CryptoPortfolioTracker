import {
  Cell,
  Pie,
  PieChart,
  Tooltip
} from "recharts";
import type { AssetSummary } from "../types/portfolio";
import { useTranslation } from "../i18n";

const CHART_COLORS = [
  "#1f6f78",
  "#4f9d8c",
  "#8fb996",
  "#d2b48c",
  "#d9845f",
  "#9b6a6c"
] as const;

export function AllocationChart({ assets }: { assets: AssetSummary[] }) {
  const { t } = useTranslation();
  const chartData = assets.map((asset, index) => ({
    name: asset.assetSymbol,
    fullName: asset.assetName,
    value: Number(asset.currentValue.toFixed(2)),
    allocationPercent: asset.allocationPercent,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));

  return (
    <section className="panel" aria-labelledby="allocation-heading">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">{t("Portfolio mix")}</p>
          <h2 id="allocation-heading">{t("Allocation")}</h2>
        </div>
      </div>

      <div className="allocation-layout">
        <div className="allocation-chart">
          <PieChart width={240} height={240}>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={104}
              paddingAngle={3}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(Number(value))}
            />
          </PieChart>
        </div>

        <ul className="allocation-legend">
          {chartData.map((asset) => (
            <li key={asset.name} className="allocation-legend__item">
              <span
                className="allocation-legend__swatch"
                style={{ backgroundColor: asset.color }}
                aria-hidden="true"
              />
              <div>
                <p className="allocation-legend__symbol">{asset.name}</p>
                <p className="allocation-legend__meta">
                  {asset.fullName} · {formatPercent(asset.allocationPercent)}
                </p>
              </div>
            </li>
          ))}
        </ul>
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
