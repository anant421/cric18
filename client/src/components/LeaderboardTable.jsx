import React from 'react';

export function BattingLeaderboard({ rows }) {
  if (!rows?.length) return <p className="text-slate-400">No batting data yet.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3">Player</th>
            <th className="px-2 py-3">Team</th>
            <th className="px-2 py-3 text-center">Inn</th>
            <th className="px-2 py-3 text-center">Runs</th>
            <th className="px-2 py-3 text-center">Balls</th>
            <th className="px-2 py-3 text-center">4s</th>
            <th className="px-2 py-3 text-center">6s</th>
            <th className="px-2 py-3 text-center">SR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.playerId} className={i % 2 ? 'bg-slate-50' : ''}>
              <td className="px-4 py-2.5 font-medium">{p.name}</td>
              <td className="px-2 py-2.5 text-slate-500">{p.team}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.innings}</td>
              <td className="px-2 py-2.5 text-center font-bold text-gold">{p.runs}</td>
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

export function BowlingLeaderboard({ rows }) {
  if (!rows?.length) return <p className="text-slate-400">No bowling data yet.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3">Player</th>
            <th className="px-2 py-3">Team</th>
            <th className="px-2 py-3 text-center">Inn</th>
            <th className="px-2 py-3 text-center">Overs</th>
            <th className="px-2 py-3 text-center">Runs</th>
            <th className="px-2 py-3 text-center">Wkts</th>
            <th className="px-2 py-3 text-center">Econ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.playerId} className={i % 2 ? 'bg-slate-50' : ''}>
              <td className="px-4 py-2.5 font-medium">{p.name}</td>
              <td className="px-2 py-2.5 text-slate-500">{p.team}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.innings}</td>
              <td className="px-2 py-2.5 text-center text-slate-600">{p.overs}</td>
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
