import React from 'react';
import { Link } from 'react-router-dom';

const statusPill = {
  LIVE: 'bg-live/15 text-live',
  SCHEDULED: 'bg-slate-500/15 text-slate-600',
  COMPLETED: 'bg-navy text-brand',
  ABANDONED: 'bg-slate-500/15 text-slate-500',
};

export default function MatchCard({ match }) {
  return (
    <Link
      to={`/matches/${match.id}`}
      className="card block p-4 transition hover:border-brand/40 hover:shadow-cardHover"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className={`pill ${statusPill[match.status] || statusPill.SCHEDULED}`}>
            {match.status === 'LIVE' && <span className="live-dot" />}
            {match.status}
          </span>
          {match.stage === 'FINAL' && <span className="pill bg-brand text-navy">FINAL</span>}
        </span>
        {match.venue && <span className="text-xs text-slate-400">{match.venue}</span>}
      </div>
      <div className="space-y-2">
        <TeamRow team={match.teamA} isWinner={match.winnerTeamId === match.teamAId} score={match.scoreA} />
        <TeamRow team={match.teamB} isWinner={match.winnerTeamId === match.teamBId} score={match.scoreB} />
      </div>
      {match.resultText && <p className="mt-3 text-sm font-medium text-gold">{match.resultText}</p>}
      {match.manOfMatch?.name && (
        <p className="mt-1 text-xs text-slate-500">
          🏆 Man of the Match: <span className="font-semibold text-navy">{match.manOfMatch.name}</span>
        </p>
      )}
      {!match.resultText && match.scheduledAt && (
        <p className="mt-3 text-xs text-slate-400">{new Date(match.scheduledAt).toLocaleString()}</p>
      )}
    </Link>
  );
}

function TeamRow({ team, isWinner, score }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${isWinner ? 'font-bold text-navy' : 'text-slate-600'}`}>
        {team?.name} <span className="text-slate-400">({team?.shortName})</span>
      </span>
      <div className="flex items-center gap-2">
        {score && <span className="text-sm font-semibold tabular-nums text-navy">{score}</span>}
        {isWinner && <span className="text-xs font-semibold text-gold">Won</span>}
      </div>
    </div>
  );
}
