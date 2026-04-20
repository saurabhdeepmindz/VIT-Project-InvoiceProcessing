/**
 * TrendChart — zero-dependency inline-SVG bar+line chart.
 * Left axis: batches per day (bars); right axis: error count (line).
 */

import type { TrendPoint } from '@/services/dashboard.api';

interface Props {
  points: TrendPoint[];
  width?: number;
  height?: number;
}

function fmtBucket(iso: string, interval: 'day' | 'week' = 'day'): string {
  const d = new Date(iso);
  if (interval === 'week') return `w/c ${d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}`;
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

export default function TrendChart({ points, width = 720, height = 240 }: Props) {
  if (points.length === 0) {
    return <p className="text-sm text-ink-600">No data in range.</p>;
  }

  const paddingL = 36, paddingR = 36, paddingT = 16, paddingB = 32;
  const plotW = width - paddingL - paddingR;
  const plotH = height - paddingT - paddingB;

  const maxBatches = Math.max(1, ...points.map(p => p.batches));
  const maxErrors = Math.max(1, ...points.map(p => p.errors));

  const barW = Math.max(4, Math.floor(plotW / points.length) - 4);
  const x = (i: number) => paddingL + (plotW * (i + 0.5)) / points.length;
  const yL = (v: number) => paddingT + plotH - (plotH * v) / maxBatches;
  const yR = (v: number) => paddingT + plotH - (plotH * v) / maxErrors;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yR(p.errors).toFixed(1)}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="block">
        {/* Y-axes */}
        <line x1={paddingL} y1={paddingT} x2={paddingL} y2={paddingT + plotH} stroke="#94B0C8" />
        <line x1={width - paddingR} y1={paddingT} x2={width - paddingR} y2={paddingT + plotH} stroke="#94B0C8" />
        {/* X-axis */}
        <line x1={paddingL} y1={paddingT + plotH} x2={width - paddingR} y2={paddingT + plotH} stroke="#94B0C8" />

        {/* Batches bars */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - barW / 2}
            y={yL(p.batches)}
            width={barW}
            height={paddingT + plotH - yL(p.batches)}
            fill="#2E75B6"
            opacity={0.8}
          >
            <title>{`${fmtBucket(p.bucket)} · batches ${p.batches} · records ${p.records} · errors ${p.errors}`}</title>
          </rect>
        ))}

        {/* Errors line */}
        <path d={linePath} fill="none" stroke="#C62828" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={`e-${i}`} cx={x(i)} cy={yR(p.errors)} r={3} fill="#C62828">
            <title>{`errors ${p.errors}`}</title>
          </circle>
        ))}

        {/* Y-axis labels */}
        <text x={4} y={paddingT + 4} fontSize={10} fill="#4A6780">{maxBatches}</text>
        <text x={4} y={paddingT + plotH} fontSize={10} fill="#4A6780">0</text>
        <text x={width - paddingR + 4} y={paddingT + 4} fontSize={10} fill="#C62828">{maxErrors}</text>
        <text x={width - paddingR + 4} y={paddingT + plotH} fontSize={10} fill="#C62828">0</text>

        {/* Axis legends */}
        <text x={paddingL} y={height - 4} fontSize={10} fill="#2E75B6">▇ batches</text>
        <text x={paddingL + 80} y={height - 4} fontSize={10} fill="#C62828">— errors</text>

        {/* X tick labels (subset) */}
        {points.map((p, i) => {
          const every = Math.max(1, Math.ceil(points.length / 8));
          if (i % every !== 0) return null;
          return (
            <text key={`t-${i}`} x={x(i)} y={paddingT + plotH + 14} fontSize={9} fill="#4A6780" textAnchor="middle">
              {fmtBucket(p.bucket)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
