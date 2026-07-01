import React from 'react';

const chipStyle = (b) => {
  if (b === 'W') return 'bg-live text-white';
  if (b.startsWith('Wd') || b.startsWith('Nb')) return 'bg-accent/80 text-white';
  if (b === '4') return 'bg-brand/80 text-white';
  if (b === '6') return 'bg-brand text-white';
  return 'bg-surface2 text-navy';
};

export default function OverTicker({ overs }) {
  if (!overs?.length) return null;
  const recent = [...overs].slice(-4).reverse();
  return (
    <div className="space-y-2">
      {recent.map((o) => (
        <div key={o.overNumber} className="flex items-center gap-2 overflow-x-auto">
          <span className="w-16 shrink-0 text-xs text-slate-400">
            Ov {o.overNumber + 1} · {o.bowlerName}
          </span>
          <div className="flex gap-1">
            {o.balls.map((b, idx) => (
              <span
                key={idx}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${chipStyle(b)}`}
              >
                {b}
              </span>
            ))}
          </div>
          <span className="ml-auto shrink-0 text-xs font-medium text-slate-500">{o.runs} runs</span>
        </div>
      ))}
    </div>
  );
}
