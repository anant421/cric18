import React, { useState } from 'react';

const WICKET_TYPES = ['BOWLED', 'CAUGHT', 'LBW', 'RUNOUT', 'STUMPED', 'HITWICKET', 'RETIRED_OUT', 'RETIRED_HURT'];
const WICKET_LABELS = {
  BOWLED: 'BOWLED',
  CAUGHT: 'CAUGHT',
  LBW: 'LBW',
  RUNOUT: 'RUN OUT',
  STUMPED: 'STUMPED',
  HITWICKET: 'HIT WICKET',
  RETIRED_OUT: 'RETIRED OUT',
  RETIRED_HURT: 'RETIRED HURT',
};
const NEEDS_FIELDER = ['CAUGHT', 'STUMPED', 'RUNOUT'];
// Only these can happen to either batter - everything else (bowled, caught,
// lbw, stumped, hit wicket) can only ever be the striker facing the ball.
const NEEDS_WHO_SELECTOR = ['RUNOUT', 'RETIRED_OUT', 'RETIRED_HURT'];

export default function WicketModal({ strikerId, strikerName, nonStrikerId, nonStrikerName, fieldingPlayers, onSubmit, onClose }) {
  const [wicketType, setWicketType] = useState('BOWLED');
  const [dismissedId, setDismissedId] = useState(strikerId);
  const [fielderId, setFielderId] = useState('');
  const [runs, setRuns] = useState(0);

  const needsFielder = NEEDS_FIELDER.includes(wicketType);
  const isRunOut = wicketType === 'RUNOUT';
  const needsWhoSelector = NEEDS_WHO_SELECTOR.includes(wicketType);

  const selectType = (t) => {
    setWicketType(t);
    // Bowled/caught/lbw/stumped/hit-wicket can only be the striker - reset
    // so a stale non-striker pick from a previous run-out/retirement doesn't
    // linger and get submitted as the wrong dismissed player.
    if (!NEEDS_WHO_SELECTOR.includes(t)) setDismissedId(strikerId);
  };

  const submit = () => {
    onSubmit({
      wicketType,
      dismissedId,
      fielderId: needsFielder ? fielderId || undefined : undefined,
      runs: isRunOut ? runs : 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <h3 className="mb-4 text-lg font-bold">Wicket</h3>

        <label className="label">Dismissal type</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {WICKET_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => selectType(t)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                wicketType === t ? 'bg-live text-white' : 'bg-surface2 text-slate-600'
              }`}
            >
              {WICKET_LABELS[t]}
            </button>
          ))}
        </div>

        {needsWhoSelector && (
          <>
            <label className="label">Who's out</label>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDismissedId(strikerId)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  dismissedId === strikerId ? 'bg-live text-white' : 'bg-surface2 text-slate-600'
                }`}
              >
                {strikerName}
              </button>
              <button
                onClick={() => setDismissedId(nonStrikerId)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  dismissedId === nonStrikerId ? 'bg-live text-white' : 'bg-surface2 text-slate-600'
                }`}
              >
                {nonStrikerName}
              </button>
            </div>
          </>
        )}

        {isRunOut && (
          <>
            <label className="label">Runs completed before run out</label>
            <div className="mb-4 flex gap-2">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setRuns(r)}
                  className={`btn ${runs === r ? 'bg-brand text-navy' : 'bg-surface2 text-slate-600'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        )}

        {needsFielder && (
          <>
            <label className="label">Fielder</label>
            <select className="input mb-4" value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
              <option value="">Select…</option>
              {fieldingPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-danger flex-1" onClick={submit} disabled={needsFielder && !fielderId}>
            Confirm Out
          </button>
        </div>
      </div>
    </div>
  );
}
