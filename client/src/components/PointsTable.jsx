import React from 'react';

export default function PointsTable({ rows }) {
  if (!rows?.length) return <p className="text-slate-400">No completed matches yet.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3">Team</th>
            <th className="px-3 py-3 text-center">P</th>
            <th className="px-3 py-3 text-center">W</th>
            <th className="px-3 py-3 text-center">L</th>
            <th className="px-3 py-3 text-center">T</th>
            <th className="px-3 py-3 text-center">NRR</th>
            <th className="px-3 py-3 text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className={i % 2 ? 'bg-slate-50' : ''}>
              <td className="px-4 py-2.5 font-medium">
                {r.name} <span className="text-slate-400">({r.shortName})</span>
              </td>
              <td className="px-3 py-2.5 text-center text-slate-600">{r.played}</td>
              <td className="px-3 py-2.5 text-center text-slate-600">{r.won}</td>
              <td className="px-3 py-2.5 text-center text-slate-600">{r.lost}</td>
              <td className="px-3 py-2.5 text-center text-slate-600">{r.tied}</td>
              <td className={`px-3 py-2.5 text-center tabular-nums ${r.nrr > 0 ? 'text-brand' : r.nrr < 0 ? 'text-live' : 'text-slate-600'}`}>
                {r.nrr > 0 ? '+' : ''}
                {r.nrr.toFixed(3)}
              </td>
              <td className="px-3 py-2.5 text-center font-bold text-brand">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
