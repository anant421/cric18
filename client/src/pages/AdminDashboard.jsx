import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState(null);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = () => api.get('/tournaments').then(setTournaments).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, []);

  const createTournament = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/tournaments', { name, season: season || undefined }, token);
      setName('');
      setSeason('');
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const removeTournament = async (id) => {
    if (!confirm('Delete this tournament and all its matches/players? This cannot be undone.')) return;
    await api.del(`/tournaments/${id}`, token);
    refresh();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold">Admin Dashboard</h1>

      <div className="card mb-8 p-5">
        <h2 className="mb-3 font-bold">Create a new tournament</h2>
        <form onSubmit={createTournament} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="CData Premier League" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="label">Season (optional)</label>
            <input className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026" />
          </div>
          <button className="btn-primary" disabled={!name || creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <h2 className="mb-3 font-bold">Your tournaments</h2>
      {!tournaments && <p className="text-slate-400">Loading…</p>}
      <div className="space-y-3">
        {tournaments?.map((t) => (
          <div key={t.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-slate-400">
                {t.teams.length} teams · {t._count?.matches ?? 0} matches
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={`/admin/tournaments/${t.id}`} className="btn-secondary">
                Manage
              </Link>
              <button className="btn-danger" onClick={() => removeTournament(t.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
