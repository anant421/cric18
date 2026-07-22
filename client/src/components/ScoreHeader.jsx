import React from 'react';
import { resolveUploadUrl } from '../api.js';

function teamName(match, teamId) {
  if (teamId === match.teamA.id) return match.teamA;
  if (teamId === match.teamB.id) return match.teamB;
  return null;
}

export default function ScoreHeader({ match, innings, strikerName, nonStrikerName, bowlerName }) {
  if (!innings) {
    return (
      <div className="card p-6 text-center text-slate-500">
        {match.status === 'COMPLETED' ? 'Match completed.' : 'Toss pending — match hasn\'t started yet.'}
      </div>
    );
  }
  const battingTeam = teamName(match, innings.battingTeamId);
  const bowlingTeam = teamName(match, innings.bowlingTeamId);
  const s = innings.summary;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400">
            {battingTeam?.logoUrl && (
              <img src={resolveUploadUrl(battingTeam.logoUrl)} alt="" className="h-4 w-4 rounded-full object-cover" />
            )}
            {battingTeam?.name} batting · Innings {innings.inningsNumber}
          </p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">
            {s.totalRuns}
            <span className="text-2xl text-slate-500">/{s.totalWickets}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {s.oversStr} overs (of {s.oversLimit}) · CRR {s.runRate}
          </p>
        </div>
        {match.status === 'LIVE' && (
          <span className="pill bg-live/15 text-live">
            <span className="live-dot" /> LIVE
          </span>
        )}
      </div>

      {innings.target != null && !s.isDone && (
        <div className="mt-4 rounded-lg bg-surface2 px-4 py-2.5 text-sm text-slate-600">
          Need <span className="font-bold text-gold">{innings.runsNeeded}</span> runs off{' '}
          <span className="font-bold">{innings.ballsRemaining}</span> balls · RRR{' '}
          <span className="font-bold">{innings.requiredRunRate}</span>
        </div>
      )}

      {s.isDone && (
        <p className="mt-3 text-sm text-slate-500">Innings complete{bowlingTeam ? ` — ${bowlingTeam.name} bowled` : ''}.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Striker</p>
          <p className="font-semibold">{strikerName || innings.live.strikerName || '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Non-striker</p>
          <p className="font-semibold">{nonStrikerName || innings.live.nonStrikerName || '—'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Bowler</p>
          <p className="font-semibold">{bowlerName || innings.live.bowlerName || '—'}</p>
        </div>
      </div>
    </div>
  );
}
