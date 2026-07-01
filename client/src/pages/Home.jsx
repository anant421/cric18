import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Home() {
  const [tournaments, setTournaments] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/tournaments')
      .then(setTournaments)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-navy to-brand p-8 text-center text-white shadow-cardHover">
        <h1 className="font-display text-5xl tracking-wide sm:text-6xl">SCORE XI</h1>
        <p className="mt-2 text-white/80">Live scores, scorecards and stats for every office cricket tournament.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tournaments && !error && <p className="text-slate-400">Loading tournaments…</p>}

      {tournaments && tournaments.length === 0 && (
        <p className="text-slate-400">No tournaments yet. An admin can create one from the Admin dashboard.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {tournaments?.map((t) => (
          <Link key={t.id} to={`/tournaments/${t.id}`} className="card block p-5 transition hover:border-brand/40 hover:shadow-cardHover">
            <h2 className="text-lg font-bold">{t.name}</h2>
            {t.season && <p className="text-sm text-slate-500">{t.season}</p>}
            <p className="mt-3 text-xs text-slate-400">
              {t.teams.length} team{t.teams.length === 1 ? '' : 's'} · {t._count?.matches ?? 0} match
              {t._count?.matches === 1 ? '' : 'es'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
