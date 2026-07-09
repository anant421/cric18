import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLES = ['BATSMAN', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'];

export default function AdminDashboard() {
  const { token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('Teams');
  const [error, setError] = useState('');

  const refresh = () =>
    api
      .get(`/tournaments/${id}`)
      .then(setTournament)
      .catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, [id]);

  if (error) return <p className="mx-auto max-w-4xl px-4 py-8 text-red-600">{error}</p>;
  if (!tournament) return <p className="mx-auto max-w-4xl px-4 py-8 text-slate-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="mb-3 inline-block text-sm text-slate-500 hover:text-navy">
        &larr; All Tournaments
      </Link>
      <TournamentNameEditor tournament={tournament} token={token} onChange={refresh} />

      <div className="mb-6 flex gap-1 border-b border-border">
        {['Teams', 'Matches'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold ${tab === t ? 'border-b-2 border-brand text-navy' : 'text-slate-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Teams' && <TeamsTab tournament={tournament} token={token} onChange={refresh} />}
      {tab === 'Matches' && <MatchesTab tournament={tournament} token={token} onChange={refresh} navigate={navigate} />}
    </div>
  );
}

function TournamentNameEditor({ tournament, token, onChange }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tournament.name);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      await api.patch(`/tournaments/${tournament.id}`, { name: name.trim() }, token);
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} className="mb-6 flex flex-wrap items-center gap-2">
        <input className="input max-w-sm text-2xl font-extrabold" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <button className="btn-primary">Save</button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setEditing(false);
            setName(tournament.name);
            setError('');
          }}
        >
          Cancel
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-2">
      <h1 className="text-2xl font-extrabold">{tournament.name}</h1>
      <button className="text-xs text-slate-400 hover:text-navy hover:underline" onClick={() => setEditing(true)}>
        Rename
      </button>
    </div>
  );
}

function TeamsTab({ tournament, token, onChange }) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [error, setError] = useState('');

  const addTeam = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/teams', { tournamentId: tournament.id, name, shortName: shortName.toUpperCase() }, token);
      setName('');
      setShortName('');
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeTeam = async (teamId) => {
    if (!confirm('Delete this team and its players?')) return;
    try {
      await api.del(`/teams/${teamId}`, token);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={addTeam} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[160px]">
          <label className="label">Team name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Strikers" />
        </div>
        <div className="w-28">
          <label className="label">Short</label>
          <input className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="SUP" maxLength={5} />
        </div>
        <button className="btn-primary" disabled={!name || !shortName}>
          Add Team
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {tournament.teams.map((team) => (
          <TeamCard key={team.id} team={team} tournamentId={tournament.id} token={token} onChange={onChange} onRemove={removeTeam} />
        ))}
        {tournament.teams.length === 0 && <p className="text-slate-400">No teams yet — add your first team above.</p>}
      </div>
    </div>
  );
}

function TeamCard({ team, tournamentId, token, onChange, onRemove }) {
  const [playerName, setPlayerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState('BATSMAN');
  const [error, setError] = useState('');

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!playerName || !mobileNumber) return;
    setError('');
    try {
      await api.post('/players', { tournamentId, teamId: team.id, name: playerName, mobileNumber, role }, token);
      setPlayerName('');
      setMobileNumber('');
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const removePlayer = async (playerId) => {
    setError('');
    try {
      await api.del(`/players/${playerId}`, token);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: team.colorHex }} />
          <h3 className="font-bold">
            {team.name} <span className="text-xs text-slate-400">({team.shortName})</span>
          </h3>
        </div>
        <button className="text-xs text-red-600 hover:underline" onClick={() => onRemove(team.id)}>
          Remove team
        </button>
      </div>

      <ul className="mb-3 space-y-1 text-sm">
        {team.players.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded px-1 py-1 hover:bg-surface2">
            <span>
              {p.name} <span className="text-xs text-slate-400">{p.role}</span>
            </span>
            <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => removePlayer(p.id)}>
              ✕
            </button>
          </li>
        ))}
        {team.players.length === 0 && <li className="text-slate-400">No players yet.</li>}
      </ul>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <form onSubmit={addPlayer} className="flex flex-wrap gap-2">
        <input
          className="input"
          placeholder="Player name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Mobile number"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
        />
        <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className="btn-secondary shrink-0" disabled={!playerName || !mobileNumber}>
          Add
        </button>
      </form>
    </div>
  );
}

function MatchesTab({ tournament, token, onChange, navigate }) {
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [oversLimit, setOversLimit] = useState(8);
  const [venue, setVenue] = useState('');
  const [error, setError] = useState('');
  const [fixtureError, setFixtureError] = useState('');
  const [busy, setBusy] = useState('');

  const addMatch = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(
        '/matches',
        { tournamentId: tournament.id, teamAId, teamBId, oversLimit: Number(oversLimit), venue: venue || undefined },
        token
      );
      setTeamAId('');
      setTeamBId('');
      setVenue('');
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeMatch = async (matchId) => {
    if (!confirm('Delete this match?')) return;
    await api.del(`/matches/${matchId}`, token);
    onChange();
  };

  const leagueMatches = tournament.matches.filter((m) => m.stage === 'LEAGUE');
  const finalMatch = tournament.matches.find((m) => m.stage === 'FINAL');
  const leagueAllCompleted = leagueMatches.length > 0 && leagueMatches.every((m) => m.status === 'COMPLETED');

  const generateFixtures = async () => {
    setFixtureError('');
    setBusy('fixtures');
    try {
      await api.post(`/tournaments/${tournament.id}/generate-fixtures`, { oversLimit: Number(oversLimit) }, token);
      onChange();
    } catch (err) {
      setFixtureError(err.message);
    } finally {
      setBusy('');
    }
  };

  const generateFinal = async () => {
    setFixtureError('');
    setBusy('final');
    try {
      await api.post(`/tournaments/${tournament.id}/generate-final`, { oversLimit: Number(oversLimit) }, token);
      onChange();
    } catch (err) {
      setFixtureError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div>
          <p className="font-semibold">League + Playoff Fixtures</p>
          <p className="text-xs text-slate-500">
            Generates a round-robin league (every team plays every other team once), then a Final between the top 2 teams on the points table.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== '' || leagueMatches.length > 0 || tournament.teams.length < 2}
            onClick={generateFixtures}
          >
            {busy === 'fixtures' ? 'Generating…' : 'Generate League Fixtures'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== '' || !leagueAllCompleted || !!finalMatch}
            onClick={generateFinal}
          >
            {busy === 'final' ? 'Setting up…' : 'Set Up Final'}
          </button>
        </div>
      </div>
      {fixtureError && <p className="text-sm text-red-600">{fixtureError}</p>}

      <form onSubmit={addMatch} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[160px]">
          <label className="label">Team A</label>
          <select className="input" value={teamAId} onChange={(e) => setTeamAId(e.target.value)}>
            <option value="">Select…</option>
            {tournament.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="label">Team B</label>
          <select className="input" value={teamBId} onChange={(e) => setTeamBId(e.target.value)}>
            <option value="">Select…</option>
            {tournament.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="label">Overs</label>
          <input className="input" type="number" min={1} value={oversLimit} onChange={(e) => setOversLimit(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="label">Venue (optional)</label>
          <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={!teamAId || !teamBId || teamAId === teamBId}>
          Schedule Match
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {tournament.teams.length < 2 && (
        <p className="text-sm text-slate-500">Add at least two teams (in the Teams tab) before scheduling a match.</p>
      )}

      <div className="space-y-3">
        {tournament.matches.map((m) => (
          <div key={m.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">
                {m.stage === 'FINAL' && <span className="mr-2 rounded bg-brand px-1.5 py-0.5 text-xs font-bold text-navy">FINAL</span>}
                {m.teamA.name} vs {m.teamB.name}
              </p>
              <p className="text-xs text-slate-400">
                {m.status} {m.resultText ? `· ${m.resultText}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {m.status === 'SCHEDULED' && (
                <button className="btn-primary" onClick={() => navigate(`/admin/matches/${m.id}/score`)}>
                  Set up &amp; Score
                </button>
              )}
              {m.status === 'LIVE' && (
                <button className="btn-primary" onClick={() => navigate(`/admin/matches/${m.id}/score`)}>
                  Continue Scoring
                </button>
              )}
              {m.status === 'COMPLETED' && (
                <Link className="btn-secondary" to={`/matches/${m.id}`}>
                  View Scorecard
                </Link>
              )}
              <button className="btn-danger" onClick={() => removeMatch(m.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {tournament.matches.length === 0 && <p className="text-slate-400">No matches scheduled yet.</p>}
      </div>
    </div>
  );
}
