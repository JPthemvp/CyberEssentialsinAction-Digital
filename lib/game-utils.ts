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

export function calcAttackPoints(isCorrect: boolean, responseTimeMs: number, timeLimitMs: number): number {
  if (!isCorrect) return 0;
  const base = 1000;
  const timeBonus = Math.floor(500 * Math.max(0, 1 - responseTimeMs / timeLimitMs));
  return base + timeBonus;
}

export function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0) return `${m}:${rem.toString().padStart(2, '0')}`;
  return `${s}s`;
}
