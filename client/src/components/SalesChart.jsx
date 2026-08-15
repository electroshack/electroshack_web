import React, { useMemo } from "react";

function fillDays(fromIso, toIso, rows) {
  const map = new Map((rows || []).map((r) => [r.date, Number(r.revenue) || 0]));
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00`);
  const to = new Date(`${toIso.slice(0, 10)}T00:00:00`);
  const out = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, revenue: map.get(key) || 0 });
  }
  return out;
}

export default function SalesChart({
  from,
  to,
  series = [],
  color = "#0787ec",
  height = 168,
  emptyLabel = "No completed sales in this range yet.",
}) {
  const points = useMemo(() => fillDays(from, to, series), [from, to, series]);
  const max = Math.max(0, ...points.map((p) => p.revenue));
  const w = 640;
  const h = height;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = Math.max(points.length, 1);
  const barW = Math.max(2, (innerW / n) * 0.72);

  return (
    <div className="w-full">
      {max <= 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">{emptyLabel}</p>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40" role="img" aria-label="Sales by day">
          {points.map((p, i) => {
            const barH = max ? (p.revenue / max) * innerH : 0;
            const x = pad.l + (i + 0.5) * (innerW / n) - barW / 2;
            const y = pad.t + innerH - barH;
            const showLabel = n <= 14 || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0;
            return (
              <g key={p.date}>
                <rect x={x} y={y} width={barW} height={Math.max(barH, p.revenue ? 2 : 0)} rx="1.5" fill={color} opacity={p.revenue ? 0.9 : 0.12} />
                {showLabel ? (
                  <text x={x + barW / 2} y={h - 6} textAnchor="middle" className="fill-gray-400" fontSize="9">
                    {p.date.slice(5)}
                  </text>
                ) : null}
                <title>{`${p.date}: $${p.revenue.toFixed(2)}`}</title>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
