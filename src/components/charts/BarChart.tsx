'use client';

import { useState } from 'react';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface BarChartProps {
  labels: string[];
  series: BarSeries[];
  /** Dipakai di tooltip, label sumbu, dan tabel pendamping. */
  formatValue: (value: number) => string;
  height?: number;
  emptyLabel?: string;
}

const PADDING = { top: 12, right: 8, bottom: 26, left: 8 };
const GROUP_GAP = 2; // celah 2px antar batang berdekatan, sesuai spesifikasi mark
const RADIUS = 4;

/**
 * Bar chart bertumpuk-berdampingan tanpa library eksternal.
 * Satu sumbu nilai saja — dua ukuran dengan skala berbeda tidak pernah
 * digabung dalam satu grafik.
 */
export default function BarChart({ labels, series, formatValue, height = 200, emptyLabel = 'Belum ada data' }: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const maxValue = Math.max(0, ...series.flatMap((s) => s.values));
  const hasData = maxValue > 0;

  const plotHeight = height - PADDING.top - PADDING.bottom;
  const groupCount = labels.length || 1;

  // Empat garis bantu, termasuk baseline nol.
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-4">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {!hasData ? (
        <div className="flex items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400" style={{ height }}>
          {emptyLabel}
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            className="w-full"
            style={{ height }}
            role="img"
            aria-label={`Grafik batang: ${series.map((s) => s.label).join(' dan ')}`}
          >
            {ticks.map((tick) => {
              const y = PADDING.top + plotHeight * (1 - tick);
              return (
                <line
                  key={tick}
                  x1={0}
                  x2={100}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? '#c3c2b7' : '#e1e0d9'}
                  strokeWidth={tick === 0 ? 1 : 0.5}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {labels.map((_, groupIndex) => {
              const groupWidth = 100 / groupCount;
              const groupX = groupIndex * groupWidth;
              const innerPadding = groupWidth * 0.18;
              const usable = groupWidth - innerPadding * 2;
              const barWidth = usable / series.length;

              return (
                <g key={groupIndex}>
                  {hover === groupIndex && (
                    <rect
                      x={groupX}
                      y={PADDING.top}
                      width={groupWidth}
                      height={plotHeight}
                      fill="#0b0b0b"
                      opacity={0.04}
                    />
                  )}
                  {series.map((s, seriesIndex) => {
                    const value = s.values[groupIndex] ?? 0;
                    const barHeight = maxValue > 0 ? (value / maxValue) * plotHeight : 0;
                    // Nilai nol tidak digambar — batang minimum palsu membuat hari
                    // tanpa penjualan terlihat seperti ada penjualan.
                    if (barHeight <= 0) return null;
                    const x = groupX + innerPadding + seriesIndex * barWidth;
                    return (
                      <rect
                        key={s.key}
                        x={x}
                        y={PADDING.top + plotHeight - barHeight}
                        width={Math.max(0.5, barWidth - GROUP_GAP / 4)}
                        height={barHeight}
                        rx={RADIUS / 4}
                        fill={s.color}
                        opacity={hover === null || hover === groupIndex ? 1 : 0.45}
                        style={{ transition: 'opacity 150ms' }}
                      />
                    );
                  })}
                  {/* Area hover selebar grup, jauh lebih besar dari batangnya. */}
                  <rect
                    x={groupX}
                    y={0}
                    width={groupWidth}
                    height={height}
                    fill="transparent"
                    onMouseEnter={() => setHover(groupIndex)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
          </svg>

          <div className="mt-1 flex" aria-hidden>
            {labels.map((label, index) => (
              <span
                key={label}
                className={`flex-1 truncate text-center text-[10px] ${
                  hover === index ? 'font-semibold text-slate-700' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            ))}
          </div>

          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{ left: `${((hover + 0.5) / groupCount) * 100}%` }}
              role="tooltip"
            >
              <p className="font-semibold">{labels[hover]}</p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="text-slate-300">{s.label}</span>
                  <span className="ml-auto font-medium">{formatValue(s.values[hover] ?? 0)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabel pendamping: identitas data tidak pernah bergantung pada warna saja. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Lihat sebagai tabel</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-semibold">Periode</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-3 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {labels.map((label, index) => (
                <tr key={label}>
                  <td className="py-1 pr-3 text-slate-600">{label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-3 text-right tabular-nums text-slate-700">
                      {formatValue(s.values[index] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
