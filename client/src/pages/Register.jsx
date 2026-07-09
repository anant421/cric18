import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

const ROLES = ['BATSMAN', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'];
const BATTING_STYLES = ['Right-hand bat', 'Left-hand bat'];
const BOWLING_STYLES = [
  'None',
  'Right-arm fast',
  'Right-arm medium',
  'Right-arm off-break',
  'Left-arm fast',
  'Left-arm medium',
  'Left-arm orthodox',
  'Legbreak',
];

export default function Register() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState('BATSMAN');
  const [battingStyle, setBattingStyle] = useState(BATTING_STYLES[0]);
  const [bowlingStyle, setBowlingStyle] = useState(BOWLING_STYLES[0]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/tournaments/${tournamentId}`).then(setTournament).catch((e) => setError(e.message));
  }, [tournamentId]);

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!teamId || !name.trim() || !mobileNumber.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      let photoUrl;
      if (photoFile) {
        const form = new FormData();
        form.append('photo', photoFile);
        const uploaded = await api.upload('/upload/photo', form);
        photoUrl = uploaded.url;
      }
      await api.post('/players', {
        tournamentId: tournament.id,
        teamId,
        name: name.trim(),
        mobileNumber: mobileNumber.trim(),
        role,
        battingStyle,
        bowlingStyle: bowlingStyle === 'None' ? null : bowlingStyle,
        photoUrl,
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !tournament) return <p className="mx-auto max-w-lg px-4 py-8 text-red-600">{error}</p>;
  if (!tournament) return <p className="mx-auto max-w-lg px-4 py-8 text-slate-400">Loading…</p>;

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="mb-2 text-2xl font-extrabold">You're in! 🏏</h1>
        <p className="mb-6 text-slate-500">You've been added to your team's squad for {tournament.name}.</p>
        <Link className="btn-primary" to={`/tournaments/${tournament.id}`}>
          Back to {tournament.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold">Register as a Player</h1>
      <p className="mb-6 text-sm text-slate-500">Join your team's squad for {tournament.name}.</p>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="label">Team</label>
          <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
            <option value="">Select your team…</option>
            {tournament.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {tournament.teams.length === 0 && <p className="mt-1 text-xs text-slate-400">No teams have been created yet — ask an admin.</p>}
        </div>

        <div>
          <label className="label">Your name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
        </div>

        <div>
          <label className="label">Mobile number</label>
          <input
            className="input"
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="98765 43210"
            required
          />
          <p className="mt-1 text-xs text-slate-400">Used only to prevent duplicate registrations - never shown publicly.</p>
        </div>

        <div>
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Batting style</label>
            <select className="input" value={battingStyle} onChange={(e) => setBattingStyle(e.target.value)}>
              {BATTING_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bowling style</label>
            <select className="input" value={bowlingStyle} onChange={(e) => setBowlingStyle(e.target.value)}>
              {BOWLING_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Photo (optional)</label>
          <div className="flex items-center gap-3">
            {photoPreview && <img src={photoPreview} alt="Preview" className="h-24 w-24 rounded-full object-cover" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} className="text-sm" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn-primary w-full" disabled={submitting || !teamId || !name.trim() || !mobileNumber.trim()}>
          {submitting ? 'Registering…' : 'Register'}
        </button>
      </form>
    </div>
  );
}
