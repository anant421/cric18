import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { isAdmin, token } = useAuth();
  const [tournaments, setTournaments] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');

  const load = () => api.get('/tournaments').then(setTournaments).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const createTournament = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.post('/tournaments', { name: name.trim(), season: season.trim() || undefined }, token);
      setName('');
      setSeason('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 rounded-2xl bg-navy p-8 text-center shadow-cardHover sm:p-12">
        <h1 className="font-display text-4xl text-brand sm:text-6xl">Independence Cup</h1>
        <p className="mt-3 text-white/70">Your tournament's home for live scores and stats.</p>
      </div>

      {isAdmin && (
        <form onSubmit={createTournament} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1">
            <label className="label">New tournament name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Independence Cup 2027" />
          </div>
          <div className="w-40">
            <label className="label">Season (optional)</label>
            <input className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2027" />
          </div>
          <button className="btn-primary" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create Tournament'}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!tournaments && !error && <p className="text-slate-400">Loading…</p>}

      {tournaments && tournaments.length === 0 && (
        <p className="text-slate-400">
          No tournaments yet.{isAdmin ? ' Create the first one above.' : ' Ask an admin to set one up.'}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {tournaments?.map((t) => (
          <div key={t.id} className="card p-5">
            <h3 className="text-lg font-bold text-navy">{t.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {t.season ? `Season ${t.season} · ` : ''}
              {t.teams.length} team{t.teams.length === 1 ? '' : 's'} · {t._count.matches} match{t._count.matches === 1 ? '' : 'es'}
            </p>
            <div className="mt-4 flex gap-2">
              <Link className="btn-primary" to={`/tournaments/${t.id}`}>
                View
              </Link>
              {isAdmin && (
                <Link className="btn-secondary" to={`/admin/tournaments/${t.id}`}>
                  Manage
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
