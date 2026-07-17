import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, resolveUploadUrl } from '../api.js';
import { socket } from '../socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import MatchCard from '../components/MatchCard.jsx';
import PointsTable from '../components/PointsTable.jsx';
import { BattingLeaderboard, BowlingLeaderboard } from '../components/LeaderboardTable.jsx';

const TABS = ['Matches', 'Points Table', 'Batting', 'Bowling', 'Squads', 'Awards'];

function PlayerAvatar({ player }) {
  const url = resolveUploadUrl(player.photoUrl);
  if (url) return <img src={url} alt={player.name} className="h-16 w-16 shrink-0 rounded-full object-cover" />;
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface2 text-base font-bold text-slate-500">
      {player.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function scoreMapFromState(state) {
  const map = {};
  for (const inn of state.innings) {
    map[inn.battingTeamId] = `${inn.summary.totalRuns}/${inn.summary.totalWickets} (${inn.summary.oversStr})`;
  }
  return map;
}

export default function TournamentDetail() {
  const { id } = useParams();
  const { isAdmin, token } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('Matches');
  const [pointsTable, setPointsTable] = useState(null);
  const [leaderboards, setLeaderboards] = useState(null);
  const [awards, setAwards] = useState(null);
  const [liveScores, setLiveScores] = useState({});
  const [error, setError] = useState('');

  const load = () =>
    api
      .get(`/tournaments/${id}`)
      .then(setTournament)
      .catch((e) => setError(e.message));

  useEffect(() => {
    setTournament(null);
    setPointsTable(null);
    setLeaderboards(null);
    setAwards(null);
    setError('');
    load();
  }, [id]);

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
    if (tab === 'Awards' && !awards) {
      api.get(`/tournaments/${tournament.id}/awards`).then(setAwards).catch((e) => setError(e.message));
    }
  }, [tab, tournament, pointsTable, leaderboards, awards]);

  if (error) return <p className="mx-auto max-w-6xl px-4 py-8 text-red-600">{error}</p>;
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
      <Link to="/" className="mb-3 inline-block text-sm text-slate-500 hover:text-navy">
        &larr; All Tournaments
      </Link>

      <div className="mb-8 rounded-2xl bg-navy p-8 text-center shadow-cardHover sm:p-12">
        <h1 className="font-display text-4xl text-brand sm:text-6xl">{tournament.name}</h1>
        <p className="mt-3 text-white/70">Score every over, live — scores, scorecards and stats for every match.</p>
        {isAdmin && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              to={`/admin/tournaments/${tournament.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Manage this tournament
            </Link>
          </div>
        )}
      </div>

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
                  {team.logoUrl ? (
                    <img src={resolveUploadUrl(team.logoUrl)} alt={team.name} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="h-3 w-3 rounded-full" style={{ background: team.colorHex }} />
                  )}
                  <h3 className="font-bold">{team.name}</h3>
                  <span className="text-xs text-slate-400">({team.shortName})</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-600">
                  {team.players.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <PlayerAvatar player={p} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-navy">{p.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {p.role}
                          {p.battingStyle && ` · ${p.battingStyle}`}
                          {p.bowlingStyle && ` · ${p.bowlingStyle}`}
                        </p>
                      </div>
                    </li>
                  ))}
                  {team.players.length === 0 && <li className="text-slate-400">No players added yet.</li>}
                </ul>
              </div>
            ))}
            {tournament.teams.length === 0 && <p className="text-slate-400">No teams added yet.</p>}
          </div>
        )}

        {tab === 'Awards' && (
          <AwardsTab awards={awards} tournamentId={tournament.id} isAdmin={isAdmin} token={token} onChange={() => setAwards(null)} />
        )}
      </div>
    </div>
  );
}

function AwardCard({ title, emoji, name, detail }) {
  if (!name) return null;
  return (
    <div className="card p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-extrabold text-navy">
        {emoji} {name}
      </p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function AwardsTab({ awards, tournamentId, isAdmin, token, onChange }) {
  if (!awards) return <p className="text-slate-400">Loading…</p>;
  const hasAnyTournamentAward = awards.playerOfTournament || awards.bestBatter || awards.bestBowler || awards.bestCatch || awards.womanOfTournament;
  if (!awards.isComplete && awards.matchAwards.length === 0) {
    return <p className="text-slate-400">Awards are calculated automatically once the tournament is complete.</p>;
  }
  if (!awards.isComplete) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-500">
          Tournament still in progress — end-of-tournament awards are revealed once the Final is played.
        </p>
        {awards.matchAwards.length > 0 && (
          <div className="card overflow-hidden">
            <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Player of the Match — by Game
            </h3>
            <ul className="divide-y divide-border/60">
              {awards.matchAwards.map((m) => (
                <li key={m.matchId} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">
                    {m.teamA} vs {m.teamB}
                  </span>
                  <span className="font-semibold text-navy">{m.manOfMatchName || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {hasAnyTournamentAward && (
        <div className="grid gap-4 sm:grid-cols-2">
          <AwardCard title="Player of the Tournament" emoji="🏆" name={awards.playerOfTournament?.name} detail={awards.playerOfTournament && `${awards.playerOfTournament.totalPoints} points`} />
          <AwardCard title="Best Batter of the Tournament" emoji="🏏" name={awards.bestBatter?.name} detail={awards.bestBatter && `${awards.bestBatter.runs} runs`} />
          <AwardCard title="Best Bowler of the Tournament" emoji="🎯" name={awards.bestBowler?.name} detail={awards.bestBowler && `${awards.bestBowler.wickets} wickets`} />
          <AwardCard title="Best Catch of the Tournament" emoji="🙌" name={awards.bestCatch?.fielderName} detail={awards.bestCatch?.matchTeams} />
          <AwardCard title="Woman of the Tournament" emoji="🌟" name={awards.womanOfTournament?.name} detail={awards.womanOfTournament && `${awards.womanOfTournament.totalPoints} points`} />
        </div>
      )}

      {isAdmin && <BestCatchPicker tournamentId={tournamentId} token={token} current={awards.bestCatch} onChange={onChange} />}

      {awards.contenders.length > 0 && (
        <div className="card overflow-hidden">
          <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Points Leaderboard
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {awards.contenders.map((p, i) => (
                <tr key={p.playerId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-right font-semibold">{p.totalPoints} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {awards.matchAwards.length > 0 && (
        <div className="card overflow-hidden">
          <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Player of the Match — by Game
          </h3>
          <ul className="divide-y divide-border/60">
            {awards.matchAwards.map((m) => (
              <li key={m.matchId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">
                  {m.teamA} vs {m.teamB}
                </span>
                <span className="font-semibold text-navy">{m.manOfMatchName || '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BestCatchPicker({ tournamentId, token, current, onChange }) {
  const [catches, setCatches] = useState(null);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/tournaments/${tournamentId}/catches`, token).then(setCatches).catch((e) => setError(e.message));
  }, [tournamentId]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/tournaments/${tournamentId}/best-catch`, { ballId: selected || null }, token);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!catches) return null;
  if (catches.length === 0) {
    return <p className="text-xs text-slate-400">No catches recorded yet — the Best Catch award can be picked once one has been taken.</p>;
  }

  return (
    <div className="card p-4">
      <p className="mb-2 text-sm font-semibold">Pick Best Catch of the Tournament</p>
      <p className="mb-3 text-xs text-slate-500">This can't be worked out from stats alone — pick the standout catch from everyone taken so far.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">{current ? `Current: ${current.fielderName} (${current.matchTeams})` : 'Select a catch…'}</option>
          {catches.map((c) => (
            <option key={c.ballId} value={c.ballId}>
              {c.fielderName} c. {c.dismissedName} · {c.matchTeams} · ov {c.overStr}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={saving || !selected} onClick={save}>
          {saving ? 'Saving…' : 'Set as Best Catch'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
