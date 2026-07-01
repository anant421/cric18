import React from 'react';

export default function SelectPlayerModal({ title, players, excludeIds = [], onSelect, onClose }) {
  const options = players.filter((p) => !excludeIds.includes(p.id));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <h3 className="mb-4 text-lg font-bold">{title}</h3>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {options.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full rounded-lg bg-surface2 px-4 py-2.5 text-left text-sm font-medium hover:bg-border"
            >
              {p.name} <span className="text-xs text-slate-400">{p.role}</span>
            </button>
          ))}
          {options.length === 0 && <p className="text-sm text-slate-400">No players available.</p>}
        </div>
        {onClose && (
          <button className="btn-secondary mt-4 w-full" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
