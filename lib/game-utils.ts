import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Max 100 pts per attack question — speed tiers
export interface SpeedTier { points: number; label: string; emoji: string; color: string; }
export function getSpeedTier(responseTimeMs: number): SpeedTier {
  const s = responseTimeMs / 1000;
  if (s < 5)  return { points: 100, label: 'Lightning Fast!', emoji: '⚡', color: '#fbbf24' };
  if (s < 10) return { points: 90,  label: 'Super Fast!',    emoji: '🚀', color: '#22c55e' };
  if (s < 20) return { points: 75,  label: 'Fast!',          emoji: '💨', color: '#4ade80' };
  if (s < 30) return { points: 60,  label: 'Good Speed',     emoji: '👍', color: '#94a3b8' };
  if (s < 45) return { points: 40,  label: 'Average',        emoji: '😐', color: '#64748b' };
  return          { points: 20,  label: 'Slow…',         emoji: '🐢', color: '#475569' };
}
export function calcAttackPoints(isCorrect: boolean, responseTimeMs: number): number {
  if (!isCorrect) return 0;
  return getSpeedTier(responseTimeMs).points;
}

export function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0) return `${m}:${rem.toString().padStart(2, '0')}`;
  return `${s}s`;
}
