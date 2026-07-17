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

  const effectiveStrikerId = innings.live.strikerId || (innings.live.outSlot === 'striker' ? pendingBatsmanId : null);
  const effectiveNonStrikerId = innings.live.nonStrikerId || (innings.live.outSlot === 'nonStriker' ? pendingBatsmanId : null);
  const effectiveBowlerId = innings.live.bowlerId || pendingBowlerId;

  const outIds = innings.battingCard.filter((b) => b.isOut).map((b) => b.playerId);
  const survivorId = innings.live.outSlot === 'striker' ? innings.live.nonStrikerId : innings.live.strikerId;

  const needsBatsmanPick = !innings.summary.isDone && innings.live.needsNewBatsman && !pendingBatsmanId;
  const needsBowlerPick = !innings.summary.isDone && innings.live.needsNewBowler && !pendingBowlerId;

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

  const strikerName = (id) => battingTeamPlayers.find((p) => p.id === id)?.name || '?';

  return (
    <div className="space-y-5">
      <ScoreHeader match={match} innings={innings} />

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

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">This Over</h3>
        <OverTicker overs={innings.overByOver} />
      </div>
      <div className="card overflow-hidden">
        <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">Batting</h3>
        <BattingTable rows={innings.battingCard} strikerId={innings.live.strikerId} />
      </div>
      <div className="card overflow-hidden">
        <h3 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">Bowling</h3>
        <BowlingTable rows={innings.bowlingCard} bowlerId={innings.live.bowlerId} />
      </div>

      {showWicket && (
        <WicketModal
          strikerId={innings.live.strikerId}
          strikerName={strikerName(innings.live.strikerId)}
          nonStrikerId={innings.live.nonStrikerId}
          nonStrikerName={strikerName(innings.live.nonStrikerId)}
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

      {!needsBatsmanPick && needsBowlerPick && (
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
