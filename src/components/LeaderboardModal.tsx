import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  beginRankedRun,
  disconnectLeaderboard,
  getOnlinePlayer,
  getRankings,
  joinLeaderboard,
  type OnlinePlayer,
  type RankedTicket,
  type RankingBoard,
} from '../utils/leaderboard';
import { hasStorageFailure } from '../utils/storage';

export function LeaderboardModal({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (ticket: RankedTicket, player: OnlinePlayer) => void;
}) {
  const [player, setPlayer] = useState(getOnlinePlayer);
  const [name, setName] = useState('');
  const [period, setPeriod] = useState<'daily' | 'all'>('daily');
  const [board, setBoard] = useState<RankingBoard | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setBoard(null);
    setError('');
    getRankings(period, player)
      .then((b) => {
        if (current) setBoard(b);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [period, player, refresh]);
  const start = async () => {
    if (!player) return;
    setBusy(true);
    setError('');
    try {
      const ticket = await beginRankedRun(player);
      if (alive.current) onStart(ticket, player);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leaderboard"
      className="absolute inset-0 z-40 p-3 pt-safe pb-safe flex items-center justify-center bg-black/90"
    >
      <div className="max-w-lg w-full max-h-[90dvh] overflow-y-auto rounded-3xl border border-cyan-400/50 bg-neutral-950 p-4 text-white">
        <div className="flex justify-between gap-2 items-center">
          <div>
            <h2 className="font-arcade text-xl">WORLD RANKINGS</h2>
            <p className="text-xs text-neutral-400">
              Best distance · community competition
            </p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="min-w-11 min-h-11 bg-white/10 rounded-xl flex justify-center items-center"
          >
            <X />
          </button>
        </div>
        <p className="text-sm text-neutral-300 mt-3">
          Ranked runs use the same daily course for everyone. Each nickname
          appears publicly. Regular play stays offline.
        </p>
        {player ? (
          <div className="my-3 space-y-2">
            <p>
              Playing as <strong>{player.name}</strong>
            </p>
            <button
              disabled={busy || !board}
              onClick={start}
              className="w-full min-h-11 rounded-xl bg-cyan-300 text-black font-bold disabled:opacity-50"
            >
              {busy ? 'Connecting…' : 'Start ranked daily'}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                disconnectLeaderboard();
                setPlayer(null);
              }}
              className="text-xs underline min-h-11"
            >
              Disconnect this profile
            </button>
            <p className="text-xs text-neutral-400">
              Restart starts a practice run. Open rankings again for a new
              ranked run.
            </p>
          </div>
        ) : (
          <form
            className="my-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const p = await joinLeaderboard(name);
                if (alive.current) setPlayer(p);
              } catch (e) {
                if (alive.current) setError((e as Error).message);
              } finally {
                if (alive.current) setBusy(false);
              }
            }}
          >
            <label className="block text-sm">
              Public nickname
              <input
                required
                minLength={3}
                maxLength={20}
                pattern="[\p{L}\p{N} _\-]{3,20}"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full min-h-11 px-3 mt-1 rounded-xl bg-neutral-800"
              />
            </label>
            <button
              disabled={busy}
              className="w-full min-h-11 mt-2 rounded-xl bg-cyan-300 text-black font-bold disabled:opacity-50"
            >
              Join rankings
            </button>
            <p className="text-xs text-neutral-400 mt-2">
              No email required. This anonymous profile stays on this device;
              clearing app data loses access to it.
            </p>
          </form>
        )}
        {hasStorageFailure() && (
          <p className="text-amber-200 text-sm">
            Device storage is unavailable; this online profile lasts for this
            session only.
          </p>
        )}
        <div className="flex gap-2 my-3">
          {(['daily', 'all'] as const).map((p) => (
            <button
              key={p}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={`flex-1 min-h-11 rounded-xl border ${period === p ? 'border-cyan-300 bg-cyan-950' : 'border-white/20'}`}
            >
              {p === 'daily' ? 'Today · UTC' : 'All time'}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-amber-200 text-sm my-2">
            {error}
          </p>
        )}
        {!board && !error && <p role="status">Loading rankings…</p>}
        {board && (
          <>
            <p className="text-xs text-neutral-400 mb-2">
              {board.totalPlayers} ranked players
              {board.day ? ` · ${board.day} UTC` : ''}
            </p>
            {board.me && (
              <p className="text-cyan-200 text-sm mb-2">
                Your rank: #{board.me.rank} · {board.me.distance}m
              </p>
            )}
            {board.entries.length ? (
              <ol className="space-y-2" aria-label="Ranked players">
                {board.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className={`flex gap-3 items-center p-3 rounded-xl ${entry.id === player?.id ? 'bg-cyan-950' : 'bg-neutral-900'}`}
                  >
                    <span className="text-cyan-200 font-bold">
                      #{entry.rank}
                    </span>
                    <span className="flex-1 break-words min-w-0">
                      {entry.name}
                    </span>
                    <span className="tabular-nums">{entry.distance}m</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No ranked runs yet. Set the first distance.</p>
            )}
          </>
        )}
        <button
          onClick={() => setRefresh((v) => v + 1)}
          disabled={busy}
          className="w-full min-h-11 mt-3 border border-white/20 rounded-xl"
        >
          Refresh rankings
        </button>
      </div>
    </div>
  );
}
