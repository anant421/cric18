import React, { useState } from 'react';

const WICKET_TYPES = ['BOWLED', 'CAUGHT', 'LBW', 'RUNOUT', 'STUMPED', 'HITWICKET', 'RETIRED'];
const NEEDS_FIELDER = ['CAUGHT', 'STUMPED', 'RUNOUT'];

export default function WicketModal({ strikerId, strikerName, nonStrikerId, nonStrikerName, fieldingPlayers, onSubmit, onClose }) {
  const [wicketType, setWicketType] = useState('BOWLED');
  const [dismissedId, setDismissedId] = useState(strikerId);
  const [fielderId, setFielderId] = useState('');
  const [runs, setRuns] = useState(0);

  const needsFielder = NEEDS_FIELDER.includes(wicketType);
  const isRunOut = wicketType === 'RUNOUT';

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
              onClick={() => setWicketType(t)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                wicketType === t ? 'bg-live text-white' : 'bg-surface2 text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {isRunOut && (
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

            <label className="label">Runs completed before run out</label>
            <div className="mb-4 flex gap-2">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setRuns(r)}
                  className={`btn ${runs === r ? 'bg-brand text-white' : 'bg-surface2 text-slate-600'}`}
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
