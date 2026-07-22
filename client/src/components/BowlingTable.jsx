import React from 'react';

export default function BowlingTable({ rows, bowlerId }) {
  if (!rows?.length) return <p className="p-4 text-sm text-slate-400">No bowling yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2.5">Bowler</th>
            <th className="px-2 py-2.5 text-center">O</th>
            <th className="px-2 py-2.5 text-center">M</th>
            <th className="px-2 py-2.5 text-center">R</th>
            <th className="px-2 py-2.5 text-center">W</th>
            <th className="px-2 py-2.5 text-center">Econ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.playerId} className="border-b border-border/50 last:border-0">
              <td className={`px-4 py-2.5 font-medium ${p.wasBarred ? 'text-live' : ''}`} title={p.wasBarred ? 'Barred mid-over' : undefined}>
                {p.name}
                {p.playerId === bowlerId && <span className="ml-1 text-gold">*</span>}
              </td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.oversStr}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.maidens}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.runsConceded}</td>
              <td className="px-2 py-2.5 text-center font-bold text-gold">{p.wickets}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.economy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
