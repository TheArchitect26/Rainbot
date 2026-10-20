import { Capacitor } from '@capacitor/core';
import { storage } from './storage';
import { RULES_VERSION } from '../game/challenges';
export interface OnlinePlayer {
  id: string;
  name: string;
  token: string;
}
export interface RankedTicket {
  id: string;
  day: string;
  rules: string;
}
export interface BoardEntry {
  id: string;
  name: string;
  distance: number;
  rank: number;
  challengeLevel?: number;
}
export interface RankingBoard {
  day: string | null;
  rules: string;
  totalPlayers: number;
  entries: BoardEntry[];
  me: BoardEntry | null;
}
const PROFILE_KEY = 'brainrot_online_player_v1';
const configured = import.meta.env.VITE_LEADERBOARD_URL?.trim();
export const leaderboardURL =
  configured || (Capacitor.isNativePlatform() ? '' : '/api/leaderboard');
export function getOnlinePlayer(): OnlinePlayer | null {
  try {
    const p = JSON.parse(storage.getItem(PROFILE_KEY) || 'null');
    return p &&
      typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      /^[a-f0-9]{64}$/.test(p.token)
      ? p
      : null;
  } catch {
    return null;
  }
}
async function request<T>(
  path: string,
  player?: OnlinePlayer | null,
  body?: unknown,
): Promise<T> {
  if (!leaderboardURL)
    throw new Error(
      'Online rankings are not connected in this build. Practice and saved progress still work.',
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${leaderboardURL}${path}`, {
      method: body ? 'POST' : 'GET',
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(player ? { Authorization: `Bearer ${player.token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error(
        'Leaderboard service is not connected. You can keep playing offline.',
      );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || 'Leaderboard request failed.');
    return data as T;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof Error && error.name === 'AbortError')
    )
      throw new Error(
        'Leaderboard is unreachable. Check your connection and try again.',
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function joinLeaderboard(name: string) {
  const player = await request<OnlinePlayer>('/players', null, { name });
  storage.setItem(PROFILE_KEY, JSON.stringify(player));
  return player;
}
export function disconnectLeaderboard() {
  storage.setItem(PROFILE_KEY, '');
}
export async function getRankings(
  period: 'daily' | 'all',
  player = getOnlinePlayer(),
) {
  const board = await request<RankingBoard>(
    `/rankings?period=${period}`,
    player,
  );
  if (!Array.isArray(board.entries) || !Number.isFinite(board.totalPlayers))
    throw new Error('Leaderboard returned an invalid response.');
  return board;
}
export async function beginRankedRun(player: OnlinePlayer) {
  const ticket = await request<RankedTicket>('/runs', player, {});
  if (
    ticket.rules !== RULES_VERSION ||
    typeof ticket.id !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(ticket.day)
  )
    throw new Error('Update the game before starting a ranked run.');
  return ticket;
}
export function finishRankedRun(
  ticket: RankedTicket,
  player: OnlinePlayer,
  distance: number,
  durationSeconds: number,
) {
  return request<RankingBoard>(
    `/runs/${encodeURIComponent(ticket.id)}/finish`,
    player,
    { distance, durationSeconds, rules: ticket.rules },
  );
}
