import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { socket, joinMatchRoom, leaveMatchRoom } from '../socket.js';
import ScoreHeader from '../components/ScoreHeader.jsx';
import BattingTable from '../components/BattingTable.jsx';
import BowlingTable from '../components/BowlingTable.jsx';
import OverTicker from '../components/OverTicker.jsx';
import ManhattanChart from '../components/ManhattanChart.jsx';

export default function MatchLive() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('live');
  const [inningsTab, setInningsTab] = useState(0);

  useEffect(() => {
    api.get(`/matches/${id}`).then(setMatch).catch((e) => setError(e.message));
    joinMatchRoom(id);
    const onUpdate = (state) => {
      if (state.id === id) setMatch(state);
    };
    socket.on('match:update', onUpdate);
    return () => {
      socket.off('match:update', onUpdate);
      leaveMatchRoom(id);
    };
  }, [id]);

  if (error) return <p className="mx-auto max-w-4xl px-4 py-8 text-red-600">{error}</p>;
  if (!match) return <p className="mx-auto max-w-4xl px-4 py-8 text-slate-400">Loading…</p>;

  const activeInnings = match.innings[match.currentInningsNumber - 1] || match.innings[match.innings.length - 1];
  const scorecardInnings = match.innings[inningsTab] || activeInnings;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to={`/tournaments/${match.tournamentId}`} className="text-sm text-slate-500 hover:text-navy">
        &larr; {match.tournamentName}
      </Link>

      <div className="mt-3 mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">
          {match.teamA.shortName} vs {match.teamB.shortName}
        </h1>
        {match.venue && <span className="text-sm text-slate-400">{match.venue}</span>}
      </div>

      {match.resultText && (
        <div className="card mb-5 p-4 text-center font-semibold text-brand">{match.resultText}</div>
      )}

      {match.tossWinnerTeamId && (
        <p className="mb-4 text-sm text-slate-500">
          {match.tossWinnerTeamId === match.teamA.id ? match.teamA.name : match.teamB.name} won the toss and chose to{' '}
          {match.tossDecision === 'BAT' ? 'bat' : 'bowl'}.
        </p>
      )}

      {match.innings.length > 0 && (
        <div className="mb-5">
          <ManhattanChart
            innings={match.innings}
            teamName={(teamId) => (teamId === match.teamA.id ? match.teamA.shortName : match.teamB.shortName)}
          />
        </div>
      )}

      {match.innings.length > 1 && (
        <div className="mb-4 flex gap-1 border-b border-border">
          {match.innings.map((inn, i) => (
            <button
              key={inn.id}
              onClick={() => {
                setView('scorecard');
                setInningsTab(i);
              }}
              className={`px-3 py-2 text-sm font-semibold ${
                view === 'scorecard' && inningsTab === i ? 'border-b-2 border-brand text-brand' : 'text-slate-500'
              }`}
            >
              Innings {inn.inningsNumber}
            </button>
          ))}
          <button
            onClick={() => setView('live')}
            className={`ml-auto px-3 py-2 text-sm font-semibold ${view === 'live' ? 'border-b-2 border-brand text-brand' : 'text-slate-500'}`}
          >
            Live
          </button>
        </div>
      )}

      {view === 'live' || match.innings.length <= 1 ? (
        <div className="space-y-5">
          <ScoreHeader match={match} innings={activeInnings} />
          {activeInnings && (
            <>
              <div className="card p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">This Over</h3>
                <OverTicker overs={activeInnings.overByOver} />
              </div>
              <div className="card overflow-hidden">
                <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Batting
                </h3>
                <BattingTable rows={activeInnings.battingCard} strikerId={activeInnings.live.strikerId} />
              </div>
              <div className="card overflow-hidden">
                <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Bowling
                </h3>
                <BowlingTable rows={activeInnings.bowlingCard} bowlerId={activeInnings.live.bowlerId} />
              </div>
            </>
          )}
        </div>
      ) : (
        <ScorecardView innings={scorecardInnings} />
      )}
    </div>
  );
}

function ScorecardView({ innings }) {
  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Batting — {innings.summary.totalRuns}/{innings.summary.totalWickets} ({innings.summary.oversStr})
        </h3>
        <BattingTable rows={innings.battingCard} strikerId={innings.live.strikerId} />
      </div>
      <div className="card overflow-hidden">
        <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">Bowling</h3>
        <BowlingTable rows={innings.bowlingCard} bowlerId={innings.live.bowlerId} />
      </div>
      {innings.fallOfWickets.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Fall of Wickets</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            {innings.fallOfWickets.map((w) => `${w.score}-${w.wicketNumber} (${w.playerName}, ${w.overStr} ov)`).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
