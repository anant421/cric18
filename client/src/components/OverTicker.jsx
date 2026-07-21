import React from 'react';

const chipStyle = (b) => {
  if (b === 'W') return 'bg-live text-white';
  if (b === 'H') return 'bg-gold text-white';
  if (b.startsWith('Wd') || b.startsWith('Nb')) return 'bg-accent/80 text-white';
  if (b === '4') return 'bg-brand/80 text-navy';
  if (b === '6') return 'bg-brand text-navy';
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
                title={b.voided ? 'Voided - over ended early, this ball does not count toward the overs used' : undefined}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  b.voided ? 'bg-surface2 text-slate-400 line-through opacity-60' : chipStyle(b.text)
                }`}
              >
                {b.text}
              </span>
            ))}
          </div>
          <span className="ml-auto shrink-0 text-xs font-medium text-slate-500">{o.runs} runs</span>
        </div>
      ))}
    </div>
  );
}
