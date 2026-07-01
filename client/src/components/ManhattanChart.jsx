import React from 'react';

const SERIES_COLORS = ['#155EEF', '#0AAFC4'];

export default function ManhattanChart({ innings, teamName }) {
  const withOvers = innings.filter((inn) => inn.overByOver.length > 0);
  if (withOvers.length === 0) return null;

  const maxOver = Math.max(...withOvers.flatMap((inn) => inn.overByOver.map((o) => o.overNumber))) + 1;
  const maxRuns = Math.max(6, ...withOvers.flatMap((inn) => inn.overByOver.map((o) => o.runs)));

  const width = 720;
  const height = 240;
  const padding = { top: 16, right: 12, bottom: 28, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const groupWidth = chartWidth / maxOver;
  const barWidth = groupWidth / (withOvers.length + 0.6);
  const yScale = (runs) => (runs / maxRuns) * chartHeight;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Runs Per Over</h3>
        <div className="flex gap-3 text-xs">
          {withOvers.map((inn, i) => (
            <span key={inn.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              {teamName(inn.battingTeamId)}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#E2E8F0"
        />
        {Array.from({ length: maxOver }).map((_, overIdx) => (
          <text
            key={overIdx}
            x={padding.left + overIdx * groupWidth + groupWidth / 2}
            y={height - padding.bottom + 16}
            fontSize="9"
            textAnchor="middle"
            fill="#94A3B8"
          >
            {overIdx + 1}
          </text>
        ))}
        {withOvers.map((inn, sIdx) =>
          inn.overByOver.map((o) => {
            const x = padding.left + o.overNumber * groupWidth + sIdx * barWidth + barWidth * 0.15;
            const barH = Math.max(yScale(o.runs), o.runs > 0 ? 2 : 0);
            const y = height - padding.bottom - barH;
            return (
              <g key={`${sIdx}-${o.overNumber}`}>
                <rect x={x} y={y} width={barWidth * 0.72} height={barH} rx="2" fill={SERIES_COLORS[sIdx % SERIES_COLORS.length]} />
                {o.wickets > 0 && <circle cx={x + (barWidth * 0.72) / 2} cy={y - 7} r="3" fill="#E11D48" />}
                <text
                  x={x + (barWidth * 0.72) / 2}
                  y={y - (o.wickets > 0 ? 13 : 4)}
                  fontSize="8"
                  textAnchor="middle"
                  fill="#475569"
                >
                  {o.runs}
                </text>
              </g>
            );
          })
        )}
      </svg>
      <p className="mt-1 text-center text-[11px] text-slate-400">Over number · red dot marks a wicket in that over</p>
    </div>
  );
}
