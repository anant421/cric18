import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import MatchCard from '../components/MatchCard.jsx';
import PointsTable from '../components/PointsTable.jsx';
import { BattingLeaderboard, BowlingLeaderboard } from '../components/LeaderboardTable.jsx';

const TABS = ['Matches', 'Points Table', 'Batting', 'Bowling', 'Squads'];

function scoreMapFromState(state) {
  const map = {};
  for (const inn of state.innings) {
    map[inn.battingTeamId] = `${inn.summary.totalRuns}/${inn.summary.totalWickets} (${inn.summary.oversStr})`;
  }
  return map;
}

export default function Home() {
  const { isAdmin, token } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [notInitialized, setNotInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [tab, setTab] = useState('Matches');
  const [pointsTable, setPointsTable] = useState(null);
  const [leaderboards, setLeaderboards] = useState(null);
  const [liveScores, setLiveScores] = useState({});
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/tournaments/cpl')
      .then(setTournament)
      .catch((e) => {
        if (e.message === 'not_initialized') setNotInitialized(true);
        else setError(e.message);
      });

  useEffect(() => {
    load();
  }, []);

  const setUp = async () => {
    setInitializing(true);
    try {
      const t = await api.post('/tournaments/cpl/init', {}, token);
      setTournament(t);
      setNotInitialized(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setInitializing(false);
    }
  };

  // Fetch + subscribe to a live score preview for any match currently in progress.
  useEffect(() => {
    if (!tournament) return;
    const liveMatchIds = tournament.matches.filter((m) => m.status === 'LIVE').map((m) => m.id);
    if (liveMatchIds.length === 0) return;

    liveMatchIds.forEach((matchId) => {
      socket.emit('match:join', matchId);
      api
        .get(`/matches/${matchId}`)
        .then((state) => setLiveScores((prev) => ({ ...prev, [matchId]: scoreMapFromState(state) })))
        .catch(() => {});
    });

    const onUpdate = (state) => {
      if (liveMatchIds.includes(state.id)) {
        setLiveScores((prev) => ({ ...prev, [state.id]: scoreMapFromState(state) }));
      }
    };
    socket.on('match:update', onUpdate);
    return () => {
      socket.off('match:update', onUpdate);
      liveMatchIds.forEach((matchId) => socket.emit('match:leave', matchId));
    };
  }, [tournament]);

  useEffect(() => {
    if (!tournament) return;
    if (tab === 'Points Table' && !pointsTable) {
      api.get(`/tournaments/${tournament.id}/points-table`).then(setPointsTable).catch((e) => setError(e.message));
    }
    if ((tab === 'Batting' || tab === 'Bowling') && !leaderboards) {
      api.get(`/tournaments/${tournament.id}/stats/leaderboards`).then(setLeaderboards).catch((e) => setError(e.message));
    }
  }, [tab, tournament, pointsTable, leaderboards]);

  const Hero = ({ children }) => (
    <div className="mb-8 rounded-2xl bg-navy p-8 text-center shadow-cardHover sm:p-12">
      <h1 className="font-display text-4xl text-brand sm:text-5xl">Score every over, live.</h1>
      <p className="mt-3 text-white/70">Live scores, scorecards and stats for the CData Premier League.</p>
      {children}
    </div>
  );

  if (error) return <p className="mx-auto max-w-6xl px-4 py-8 text-red-600">{error}</p>;

  if (notInitialized) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Hero>
          <div className="mt-6">
            {isAdmin ? (
              <button className="btn-primary" disabled={initializing} onClick={setUp}>
                {initializing ? 'Setting up…' : 'Set Up CData Premier League'}
              </button>
            ) : (
              <p className="text-sm text-white/70">The tournament hasn't been set up yet — ask an admin to sign in and get it started.</p>
            )}
          </div>
        </Hero>
      </div>
    );
  }

  if (!tournament) return <p className="mx-auto max-w-6xl px-4 py-8 text-slate-400">Loading…</p>;

  const liveMatches = tournament.matches.filter((m) => m.status === 'LIVE');
  const otherMatches = tournament.matches.filter((m) => m.status !== 'LIVE');

  const withScores = (m) => ({
    ...m,
    scoreA: liveScores[m.id]?.[m.teamAId],
    scoreB: liveScores[m.id]?.[m.teamBId],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Hero />

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === t ? 'border-brand text-navy' : 'border-transparent text-slate-500 hover:text-navy'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'Matches' && (
          <div className="space-y-6">
            {liveMatches.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-live">Live Now</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {liveMatches.map((m) => (
                    <MatchCard key={m.id} match={withScores(m)} />
                  ))}
                </div>
              </section>
            )}
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">All Matches</h3>
              {otherMatches.length === 0 ? (
                <p className="text-slate-400">No other matches yet.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {otherMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'Points Table' && <PointsTable rows={pointsTable} />}
        {tab === 'Batting' && <BattingLeaderboard rows={leaderboards?.topBatting} />}
        {tab === 'Bowling' && <BowlingLeaderboard rows={leaderboards?.topBowling} />}

        {tab === 'Squads' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {tournament.teams.map((team) => (
              <div key={team.id} className="card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: team.colorHex }} />
                  <h3 className="font-bold">{team.name}</h3>
                  <span className="text-xs text-slate-400">({team.shortName})</span>
                </div>
                <ul className="space-y-1 text-sm text-slate-600">
                  {team.players.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-400">{p.role}</span>
                    </li>
                  ))}
                  {team.players.length === 0 && <li className="text-slate-400">No players added yet.</li>}
                </ul>
              </div>
            ))}
            {tournament.teams.length === 0 && <p className="text-slate-400">No teams added yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
