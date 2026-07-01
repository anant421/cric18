import React from 'react';

export default function BattingTable({ rows, strikerId }) {
  if (!rows?.length) return <p className="p-4 text-sm text-slate-400">Yet to bat.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2.5">Batter</th>
            <th className="px-2 py-2.5 text-center">R</th>
            <th className="px-2 py-2.5 text-center">B</th>
            <th className="px-2 py-2.5 text-center">4s</th>
            <th className="px-2 py-2.5 text-center">6s</th>
            <th className="px-2 py-2.5 text-center">SR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.playerId} className="border-b border-border/50 last:border-0">
              <td className="px-4 py-2.5">
                <div className="font-medium">
                  {p.name}
                  {p.playerId === strikerId && <span className="ml-1 text-brand">*</span>}
                </div>
                <div className="text-xs text-slate-400">{p.isOut ? p.dismissal : 'not out'}</div>
              </td>
              <td className="px-2 py-2.5 text-center font-bold">{p.runs}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.balls}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.fours}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.sixes}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.strikeRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
