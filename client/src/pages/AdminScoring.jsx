import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { socket, joinMatchRoom, leaveMatchRoom } from '../socket.js';
import ScoreHeader from '../components/ScoreHeader.jsx';
import BattingTable from '../components/BattingTable.jsx';
import BowlingTable from '../components/BowlingTable.jsx';
import OverTicker from '../components/OverTicker.jsx';
import ScoringPad from '../components/ScoringPad.jsx';
import WicketModal from '../components/WicketModal.jsx';
import SelectPlayerModal from '../components/SelectPlayerModal.jsx';

function teamPlayers(match, teamId) {
  if (!match) return [];
  if (teamId === match.teamA.id) return match.teamA.players;
  if (teamId === match.teamB.id) return match.teamB.players;
  return [];
}

export default function AdminScoring() {
  const { id } = useParams();
  const { token } = useAuth();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showWicket, setShowWicket] = useState(false);
  const [pendingBatsmanId, setPendingBatsmanId] = useState(null);
  const [pendingBowlerId, setPendingBowlerId] = useState(null);
  // Manual backup override, for when the derived state is wrong for any
  // reason - takes priority over everything else when set. Reset every ball
  // so a correction never silently carries over to deliveries it wasn't
  // meant for.
  const [manualStrikerId, setManualStrikerId] = useState(null);
  const [manualNonStrikerId, setManualNonStrikerId] = useState(null);
  const [manualBowlerId, setManualBowlerId] = useState(null);
  // Shown once per over-ending event; the bowler picker only appears after
  // this is approved.
  const [endOfOverApproved, setEndOfOverApproved] = useState(false);

  const refresh = () => api.get(`/matches/${id}`).then(setMatch).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
    joinMatchRoom(id);
    const onUpdate = (state) => {
      if (state.id === id) setMatch(state);
    };
    socket.on('match:update', onUpdate);
    return () => {
      socket.off('match:update', onUpdate);
      leaveMatchRoom(id);
    };
  }, [id]);

  useEffect(() => {
    setPendingBatsmanId(null);
    setPendingBowlerId(null);
    setManualStrikerId(null);
    setManualNonStrikerId(null);
    setManualBowlerId(null);
    setEndOfOverApproved(false);
  }, [match?.currentInningsNumber, match?.innings?.[match.currentInningsNumber - 1]?.expectedSequence]);

  if (error) return <p className="mx-auto max-w-3xl px-4 py-8 text-red-600">{error}</p>;
  if (!match) return <p className="mx-auto max-w-3xl px-4 py-8 text-slate-400">Loading…</p>;

  const needsToss = match.innings.length === 0;
  const activeInnings = match.innings[match.currentInningsNumber - 1];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to={`/admin/tournaments/${match.tournamentId}`} className="text-sm text-slate-500 hover:text-navy">
        &larr; Back to setup
      </Link>
      <h1 className="mt-2 mb-5 text-xl font-bold">
        {match.teamA.name} vs {match.teamB.name}
      </h1>

      {notice && <div className="mb-4 rounded-lg bg-accent/15 px-4 py-2.5 text-sm text-accent">{notice}</div>}

      {match.status === 'COMPLETED' && (
        <div className="card mb-5 p-4 text-center font-semibold text-gold">{match.resultText}</div>
      )}

      {needsToss && (
        <TossForm
          match={match}
          token={token}
          onDone={refresh}
          onError={setError}
        />
      )}

      {!needsToss && activeInnings && (
        <ScoringConsole
          match={match}
          innings={activeInnings}
          token={token}
          pendingBatsmanId={pendingBatsmanId}
          pendingBowlerId={pendingBowlerId}
          setPendingBatsmanId={setPendingBatsmanId}
          setPendingBowlerId={setPendingBowlerId}
          manualStrikerId={manualStrikerId}
          manualNonStrikerId={manualNonStrikerId}
          manualBowlerId={manualBowlerId}
          setManualStrikerId={setManualStrikerId}
          setManualNonStrikerId={setManualNonStrikerId}
          setManualBowlerId={setManualBowlerId}
          endOfOverApproved={endOfOverApproved}
          setEndOfOverApproved={setEndOfOverApproved}
          showWicket={showWicket}
          setShowWicket={setShowWicket}
          onError={setError}
          onConflict={() => {
            setNotice('Someone else just scored that ball — view refreshed to the latest state.');
            refresh();
            setTimeout(() => setNotice(''), 4000);
          }}
          refresh={refresh}
        />
      )}

      {!needsToss && !activeInnings && match.status !== 'COMPLETED' && (
        <p className="text-slate-400">Waiting for next innings…</p>
      )}
    </div>
  );
}

function TossForm({ match, token, onDone, onError }) {
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState('');
  const [tossDecision, setTossDecision] = useState('BAT');
  const [umpire1, setUmpire1] = useState('');
  const [umpire2, setUmpire2] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/matches/${match.id}/toss`, { tossWinnerTeamId, tossDecision, umpire1, umpire2 }, token);
      onDone();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-4 font-bold">Toss</h2>
      <label className="label">Toss winner</label>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[match.teamA, match.teamB].map((t) => (
          <button
            key={t.id}
            onClick={() => setTossWinnerTeamId(t.id)}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
              tossWinnerTeamId === t.id ? 'bg-brand text-navy' : 'bg-surface2 text-slate-600'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <label className="label">Elected to</label>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {['BAT', 'BOWL'].map((d) => (
          <button
            key={d}
            onClick={() => setTossDecision(d)}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
              tossDecision === d ? 'bg-brand text-navy' : 'bg-surface2 text-slate-600'
            }`}
          >
            {d === 'BAT' ? 'Bat' : 'Bowl'}
          </button>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <div>
          <label className="label">Umpire 1 (optional)</label>
          <input className="input" value={umpire1} onChange={(e) => setUmpire1(e.target.value)} placeholder="Name" />
        </div>
        <div>
          <label className="label">Umpire 2 (optional)</label>
          <input className="input" value={umpire2} onChange={(e) => setUmpire2(e.target.value)} placeholder="Name" />
        </div>
      </div>
      <button className="btn-primary w-full" disabled={!tossWinnerTeamId || saving} onClick={submit}>
        {saving ? 'Starting…' : 'Confirm Toss & Start Innings 1'}
      </button>
    </div>
  );
}

function ScoringConsole({
  match,
  innings,
  token,
  pendingBatsmanId,
  pendingBowlerId,
  setPendingBatsmanId,
  setPendingBowlerId,
  manualStrikerId,
  manualNonStrikerId,
  manualBowlerId,
  setManualStrikerId,
  setManualNonStrikerId,
  setManualBowlerId,
  endOfOverApproved,
  setEndOfOverApproved,
  showWicket,
  setShowWicket,
  onError,
  onConflict,
  refresh,
}) {
  const battingTeamPlayers = teamPlayers(match, innings.battingTeamId);
  const bowlingTeamPlayers = teamPlayers(match, innings.bowlingTeamId);

  const noOpenersYet = innings.expectedSequence === 0 && !innings.live.strikerId && !innings.live.needsNewBatsman;

  if (noOpenersYet) {
    return (
      <LineupForm
        match={match}
        innings={innings}
        battingTeamPlayers={battingTeamPlayers}
        bowlingTeamPlayers={bowlingTeamPlayers}
        token={token}
        onDone={refresh}
        onError={onError}
      />
    );
  }

  const effectiveStrikerId = manualStrikerId || innings.live.strikerId || (innings.live.outSlot === 'striker' ? pendingBatsmanId : null);
  const effectiveNonStrikerId = manualNonStrikerId || innings.live.nonStrikerId || (innings.live.outSlot === 'nonStriker' ? pendingBatsmanId : null);
  const effectiveBowlerId = manualBowlerId || innings.live.bowlerId || pendingBowlerId;

  const outIds = innings.battingCard.filter((b) => b.isOut).map((b) => b.playerId);
  const survivorId = innings.live.outSlot === 'striker' ? innings.live.nonStrikerId : innings.live.strikerId;

  const needsBatsmanPick = !innings.summary.isDone && innings.live.needsNewBatsman && !pendingBatsmanId && !manualStrikerId && !manualNonStrikerId;
  const needsBowlerPick = !innings.summary.isDone && innings.live.needsNewBowler && !pendingBowlerId && !manualBowlerId;

  const canScore = !innings.summary.isDone && effectiveStrikerId && effectiveNonStrikerId && effectiveBowlerId;

  const submitBall = async (payload) => {
    try {
      await api.post(
        `/matches/${match.id}/ball`,
        {
          inningsId: innings.id,
          expectedSequence: innings.expectedSequence,
          strikerId: effectiveStrikerId,
          nonStrikerId: effectiveNonStrikerId,
          bowlerId: effectiveBowlerId,
          ...payload,
        },
        token
      );
      setPendingBatsmanId(null);
      setPendingBowlerId(null);
      setShowWicket(false);
    } catch (err) {
      if (err.message.includes('changed')) onConflict();
      else onError(err.message);
    }
  };

  const undo = async () => {
    if (!confirm('Undo the last ball?')) return;
    try {
      await api.post(`/matches/${match.id}/undo`, { inningsId: innings.id }, token);
    } catch (err) {
      onError(err.message);
    }
  };

  const lastOver = innings.overByOver[innings.overByOver.length - 1];
  // Only meaningful once the CURRENT bowler has actually bowled at least one
  // ball in this attempt - right after picking a new bowler, lastOver still
  // points at the previous (already finished) over until they've bowled
  // something, and this must never let that stale over get voided instead.
  const canEndOverEarly = canScore && lastOver && lastOver.balls.length > 0 && lastOver.bowlerId === effectiveBowlerId;

  const endOverEarly = async () => {
    if (!confirm("End this over now? The balls already bowled keep their runs/wickets, but a new bowler will be needed and the next ball starts a fresh over.")) return;
    try {
      await api.post(`/matches/${match.id}/end-over`, { inningsId: innings.id }, token);
    } catch (err) {
      onError(err.message);
    }
  };

  const strikerName = (id) => battingTeamPlayers.find((p) => p.id === id)?.name || '?';
  // Bowler can come from either roster depending on which team is bowling,
  // and this is also used for the striker/non-striker header labels so a
  // pending pick shows up immediately instead of waiting for the first ball.
  const playerName = (id) => [...battingTeamPlayers, ...bowlingTeamPlayers].find((p) => p.id === id)?.name || null;

  const showEndOfOverSummary = !needsBatsmanPick && needsBowlerPick && !endOfOverApproved && lastOver;

  // A freshly-picked batter/bowler shouldn't wait for their first ball to
  // show up in these tables - mirrors the instant-name fix already applied
  // to the ScoreHeader striker/non-striker/bowler labels.
  const displayBattingCard = [...innings.battingCard];
  const battedIds = new Set(displayBattingCard.map((p) => p.playerId));
  [effectiveStrikerId, effectiveNonStrikerId].forEach((id) => {
    if (id && !battedIds.has(id)) {
      displayBattingCard.push({
        playerId: id, name: playerName(id) || '?', runs: 0, balls: 0,
        fours: 0, sixes: 0, isOut: false, dismissal: null, strikeRate: 0,
      });
      battedIds.add(id);
    }
  });

  const displayBowlingCard = [...innings.bowlingCard];
  if (effectiveBowlerId && !displayBowlingCard.some((p) => p.playerId === effectiveBowlerId)) {
    displayBowlingCard.push({
      playerId: effectiveBowlerId, name: playerName(effectiveBowlerId) || '?', oversStr: '0.0',
      maidens: 0, runsConceded: 0, wickets: 0, economy: 0, wasBarred: false,
    });
  }

  return (
    <div className="space-y-5">
      <ScoreHeader
        match={match}
        innings={innings}
        strikerName={playerName(effectiveStrikerId)}
        nonStrikerName={playerName(effectiveNonStrikerId)}
        bowlerName={playerName(effectiveBowlerId)}
      />

      <ManualCorrectionPanel
        battingTeamPlayers={battingTeamPlayers}
        bowlingTeamPlayers={bowlingTeamPlayers}
        strikerId={effectiveStrikerId}
        nonStrikerId={effectiveNonStrikerId}
        bowlerId={effectiveBowlerId}
        onSetStriker={setManualStrikerId}
        onSetNonStriker={setManualNonStrikerId}
        onSetBowler={setManualBowlerId}
      />

      {innings.summary.isDone && innings.inningsNumber === 1 && match.innings.length === 1 && (
        <button
          className="btn-primary w-full"
          onClick={async () => {
            try {
              await api.post(`/matches/${match.id}/start-second-innings`, {}, token);
            } catch (err) {
              onError(err.message);
            }
          }}
        >
          Start 2nd Innings
        </button>
      )}

      {!innings.summary.isDone && (
        <ScoringPad
          disabled={!canScore}
          onBall={submitBall}
          onWicket={() => setShowWicket(true)}
          onUndo={undo}
        />
      )}

      {canEndOverEarly && (
        <button className="btn-secondary w-full" onClick={endOverEarly}>
          End Over Early — Bowler Barred
        </button>
      )}

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">This Over</h3>
        <OverTicker overs={innings.overByOver} />
      </div>
      <div className="card overflow-hidden">
        <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">Batting</h3>
        <BattingTable rows={displayBattingCard} strikerId={effectiveStrikerId} />
      </div>
      <div className="card overflow-hidden">
        <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">Bowling</h3>
        <BowlingTable rows={displayBowlingCard} bowlerId={effectiveBowlerId} />
      </div>

      {showWicket && (
        <WicketModal
          strikerId={effectiveStrikerId}
          strikerName={strikerName(effectiveStrikerId)}
          nonStrikerId={effectiveNonStrikerId}
          nonStrikerName={strikerName(effectiveNonStrikerId)}
          fieldingPlayers={bowlingTeamPlayers}
          onClose={() => setShowWicket(false)}
          onSubmit={(w) => submitBall({ type: 'RUN', runs: w.runs, isWicket: true, wicketType: w.wicketType, dismissedId: w.dismissedId, fielderId: w.fielderId })}
        />
      )}

      {needsBatsmanPick && (
        <SelectPlayerModal
          title="Select next batsman"
          players={battingTeamPlayers}
          excludeIds={[...outIds, survivorId].filter(Boolean)}
          onSelect={setPendingBatsmanId}
        />
      )}

      {showEndOfOverSummary && (
        <EndOfOverModal summary={innings.summary} lastOver={lastOver} onApprove={() => setEndOfOverApproved(true)} />
      )}

      {!needsBatsmanPick && needsBowlerPick && endOfOverApproved && (
        <SelectPlayerModal
          title="Select bowler for next over"
          players={bowlingTeamPlayers}
          excludeIds={[innings.live.previousBowlerId].filter(Boolean)}
          onSelect={setPendingBowlerId}
        />
      )}
    </div>
  );
}

// Shown right when an over ends (normal completion or a barred bowler's over
// being voided), before the bowler-for-next-over picker appears - a quick
// checkpoint so the scorer can confirm the total/last over before moving on.
function EndOfOverModal({ summary, lastOver, onApprove }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-surface p-6 text-center sm:rounded-2xl">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Over {lastOver.overNumber + 1} complete</p>
        <p className="mt-2 text-4xl font-extrabold tabular-nums">
          {summary.totalRuns}
          <span className="text-2xl text-slate-500">/{summary.totalWickets}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {lastOver.runs} run{lastOver.runs === 1 ? '' : 's'} in that over
          {lastOver.wickets > 0 ? ` · ${lastOver.wickets} wicket${lastOver.wickets === 1 ? '' : 's'}` : ''}
        </p>
        <button className="btn-primary mt-5 w-full" onClick={onApprove}>
          Continue to Next Over
        </button>
      </div>
    </div>
  );
}

// Backup for when the derived state is wrong for any reason - lets the
// admin directly set who's on strike, who's the non-striker, and who's
// bowling right now, overriding whatever was worked out from the ball log.
// Collapsed by default since it's only meant to be reached for when
// something needs correcting, not part of the normal scoring flow.
function ManualCorrectionPanel({
  battingTeamPlayers,
  bowlingTeamPlayers,
  strikerId,
  nonStrikerId,
  bowlerId,
  onSetStriker,
  onSetNonStriker,
  onSetBowler,
}) {
  const [open, setOpen] = useState(false);
  const [draftStrikerId, setDraftStrikerId] = useState(strikerId || '');
  const [draftNonStrikerId, setDraftNonStrikerId] = useState(nonStrikerId || '');
  const [draftBowlerId, setDraftBowlerId] = useState(bowlerId || '');

  // Keep the draft in sync with whatever's actually in effect right now
  // (e.g. after a ball is scored) so reopening the panel never shows a
  // stale earlier draft instead of the current real state.
  useEffect(() => {
    setDraftStrikerId(strikerId || '');
    setDraftNonStrikerId(nonStrikerId || '');
    setDraftBowlerId(bowlerId || '');
  }, [strikerId, nonStrikerId, bowlerId]);

  const hasChanges =
    draftStrikerId !== (strikerId || '') || draftNonStrikerId !== (nonStrikerId || '') || draftBowlerId !== (bowlerId || '');

  const apply = () => {
    onSetStriker(draftStrikerId || null);
    onSetNonStriker(draftNonStrikerId || null);
    onSetBowler(draftBowlerId || null);
  };

  return (
    <div className="card p-4">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Manual Correction (backup)</span>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            Only use this if something's wrong - pick the correct players, then tap Update to apply it immediately.
          </p>
          <div>
            <label className="label">Striker</label>
            <select className="input" value={draftStrikerId} onChange={(e) => setDraftStrikerId(e.target.value)}>
              <option value="">Select…</option>
              {battingTeamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Non-striker</label>
            <select className="input" value={draftNonStrikerId} onChange={(e) => setDraftNonStrikerId(e.target.value)}>
              <option value="">Select…</option>
              {battingTeamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bowler</label>
            <select className="input" value={draftBowlerId} onChange={(e) => setDraftBowlerId(e.target.value)}>
              <option value="">Select…</option>
              {bowlingTeamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={() => {
                onSetStriker(null);
                onSetNonStriker(null);
                onSetBowler(null);
              }}
            >
              Reset to Automatic
            </button>
            <button className="btn-primary flex-1" disabled={!hasChanges} onClick={apply}>
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LineupForm({ innings, battingTeamPlayers, bowlingTeamPlayers, token, onDone, onError, match }) {
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/matches/${match.id}/lineup`, { inningsId: innings.id, strikerId, nonStrikerId, bowlerId }, token);
      onDone();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-4 font-bold">Innings {innings.inningsNumber} — Opening Lineup</h2>

      <label className="label">On strike</label>
      <select className="input mb-3" value={strikerId} onChange={(e) => setStrikerId(e.target.value)}>
        <option value="">Select…</option>
        {battingTeamPlayers.map((p) => (
          <option key={p.id} value={p.id} disabled={p.id === nonStrikerId}>
            {p.name}
          </option>
        ))}
      </select>

      <label className="label">Non-striker</label>
      <select className="input mb-3" value={nonStrikerId} onChange={(e) => setNonStrikerId(e.target.value)}>
        <option value="">Select…</option>
        {battingTeamPlayers.map((p) => (
          <option key={p.id} value={p.id} disabled={p.id === strikerId}>
            {p.name}
          </option>
        ))}
      </select>

      <label className="label">Opening bowler</label>
      <select className="input mb-5" value={bowlerId} onChange={(e) => setBowlerId(e.target.value)}>
        <option value="">Select…</option>
        {bowlingTeamPlayers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button className="btn-primary w-full" disabled={!strikerId || !nonStrikerId || !bowlerId || saving} onClick={submit}>
        {saving ? 'Starting…' : 'Start Innings'}
      </button>
    </div>
  );
}
