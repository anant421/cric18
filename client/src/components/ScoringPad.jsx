import React, { useState } from 'react';

const RUN_VALUES = [0, 1, 2, 3, 4, 6];
const EXTRA_RUN_CHOICES = [0, 1, 2, 3, 4];
const OVERTHROW_CHOICES = [1, 2, 3, 4, 6];

export default function ScoringPad({ onBall, onWicket, onUndo, disabled }) {
  const [extraMode, setExtraMode] = useState(null); // 'WIDE' | 'NOBALL' | 'BYE' | 'LEGBYE' | 'OVERTHROW_BASE' | 'OVERTHROW_EXTRA'
  const [overthrowBase, setOverthrowBase] = useState(0);

  const submitExtra = (runs) => {
    onBall({ type: extraMode, runs });
    setExtraMode(null);
  };

  const pickOverthrowBase = (runs) => {
    setOverthrowBase(runs);
    setExtraMode('OVERTHROW_EXTRA');
  };

  const submitOverthrow = (extra) => {
    onBall({ type: 'RUN', runs: overthrowBase + extra, isOverthrow: true });
    setExtraMode(null);
    setOverthrowBase(0);
  };

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Score this ball</h3>

      {extraMode === 'OVERTHROW_BASE' && (
        <div>
          <p className="mb-2 text-sm text-slate-600">Overthrow — runs actually completed before the throw:</p>
          <div className="flex flex-wrap gap-2">
            {RUN_VALUES.map((r) => (
              <button key={r} className="btn-secondary min-w-[3rem]" onClick={() => pickOverthrowBase(r)}>
                {r}
              </button>
            ))}
          </div>
          <button
            className="btn-secondary mt-3"
            onClick={() => {
              setExtraMode(null);
              setOverthrowBase(0);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {extraMode === 'OVERTHROW_EXTRA' && (
        <div>
          <p className="mb-2 text-sm text-slate-600">
            Plus runs from the overthrow (added on top of {overthrowBase}, all credited to the batter):
          </p>
          <div className="flex flex-wrap gap-2">
            {OVERTHROW_CHOICES.map((r) => (
              <button key={r} className="btn-secondary min-w-[3rem]" onClick={() => submitOverthrow(r)}>
                +{r}
              </button>
            ))}
          </div>
          <button
            className="btn-secondary mt-3"
            onClick={() => {
              setExtraMode(null);
              setOverthrowBase(0);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {extraMode && extraMode !== 'OVERTHROW_BASE' && extraMode !== 'OVERTHROW_EXTRA' && (
        <div>
          <p className="mb-2 text-sm text-slate-600">
            {extraMode === 'WIDE' && 'Wide — extra run(s) taken beyond the automatic 1:'}
            {extraMode === 'NOBALL' && 'No ball — runs scored off the bat:'}
            {extraMode === 'BYE' && 'Byes — total runs run:'}
            {extraMode === 'LEGBYE' && 'Leg byes — total runs run:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {(extraMode === 'NOBALL' ? RUN_VALUES : EXTRA_RUN_CHOICES).map((r) => (
              <button key={r} className="btn-secondary min-w-[3rem]" onClick={() => submitExtra(r)}>
                {r}
              </button>
            ))}
          </div>
          <button className="btn-secondary mt-3" onClick={() => setExtraMode(null)}>
            Cancel
          </button>
        </div>
      )}

      {!extraMode && (
        <>
          <div className="mb-3 grid grid-cols-6 gap-2">
            {RUN_VALUES.map((r) => (
              <button
                key={r}
                disabled={disabled}
                className="btn bg-surface2 text-lg font-extrabold text-navy hover:bg-border"
                onClick={() => onBall({ type: 'RUN', runs: r })}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button disabled={disabled} className="btn-secondary" onClick={() => setExtraMode('WIDE')}>
              Wide
            </button>
            <button disabled={disabled} className="btn-secondary" onClick={() => setExtraMode('NOBALL')}>
              No Ball
            </button>
            <button disabled={disabled} className="btn-secondary" onClick={() => setExtraMode('BYE')}>
              Bye
            </button>
            <button disabled={disabled} className="btn-secondary" onClick={() => setExtraMode('LEGBYE')}>
              Leg Bye
            </button>
          </div>
          <div className="mt-2">
            <button disabled={disabled} className="btn-secondary w-full" onClick={() => setExtraMode('OVERTHROW_BASE')}>
              Overthrow
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={disabled} className="btn-danger" onClick={onWicket}>
              Wicket
            </button>
            <button disabled={disabled} className="btn-secondary" onClick={onUndo}>
              Undo Last Ball
            </button>
          </div>
        </>
      )}
    </div>
  );
}
