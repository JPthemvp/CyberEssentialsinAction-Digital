'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  CYBER_ATTACK_QUESTIONS, CYBER_QUEST_SCENARIOS, SECTORS,
  getShuffledAttackQuestion, getQuestMCQ,
  type QuestScenario, type Difficulty,
} from '@/lib/game-data';
import { getSpeedTier } from '@/lib/game-utils';
import { QuestionExample, hasExample } from '@/components/QuestionExample';
import { ScenarioAnimation } from '@/components/ScenarioAnimation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

type GameMode = 'attack' | 'quest';
type GameStatus = 'lobby' | 'question' | 'reveal' | 'reveal_example' | 'leaderboard' | 'ended';

interface Player { id: string; player_name: string; score: number; avatar_color: string; is_host: boolean; last_seen_at: string | null; }
interface Room { room_code: string; sector: string; mode: GameMode; status: GameStatus; current_question_index: number; current_scenario_id: string | null; question_started_at: string | null; difficulty: Difficulty; }
interface Answer { id: string; player_id: string; answer_index: number | null; answer_text: string | null; is_correct: boolean | null; points_earned: number; response_time_ms: number | null; }

const OPTION_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

// ─── Animated circular countdown clock ───────────────────────────────────────
function CircularTimer({ timeLeft, totalTime }: { timeLeft: number; totalTime: number }) {
  const pct = Math.max(0, timeLeft / totalTime);
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f97316' : '#ef4444';
  const pulse = timeLeft <= 10 && timeLeft > 0;
  return (
    <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
      <svg width="110" height="110" viewBox="0 0 110 110" style={{ animation: pulse ? 'pulse 0.8s ease-in-out infinite alternate' : 'none' }}>
        <style>{`@keyframes pulse { from { transform: scale(1); } to { transform: scale(1.06); } }`}</style>
        <circle cx="55" cy="55" r={r} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s ease' }}
        />
        {/* Clock hand markers */}
        {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
          const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
          const x1 = 55 + 38 * Math.cos(angle);
          const y1 = 55 + 38 * Math.sin(angle);
          const x2 = 55 + (i % 3 === 0 ? 32 : 35) * Math.cos(angle);
          const y2 = 55 + (i % 3 === 0 ? 32 : 35) * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.2)" strokeWidth={i % 3 === 0 ? 2 : 1} />;
        })}
        <text x="55" y="50" textAnchor="middle" fill="white" fontSize="22" fontWeight="900">{timeLeft}</text>
        <text x="55" y="66" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontWeight="600">SEC</text>
      </svg>
    </div>
  );
}

// ─── Vertical bar chart for attack answers ────────────────────────────────────
function VerticalBarChart({ distribution, totalPlayers, showCorrect = true }: {
  distribution: { index: number; count: number; isCorrect: boolean }[];
  totalPlayers: number;
  showCorrect?: boolean;
}) {
  const max = Math.max(...distribution.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', height: 240, padding: '0 0.5rem' }}>
      {distribution.map(d => {
        const pct = d.count / max;
        const barH = Math.max(pct * 100, d.count > 0 ? 8 : 0);
        const highlight = showCorrect && d.isCorrect;
        return (
          <div key={d.index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.2rem' }}>{d.count}</span>
            <div style={{ width: '100%', position: 'relative', height: 170, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', background: highlight ? '#22c55e' : OPTION_COLORS[d.index],
                height: `${barH}%`, borderRadius: '6px 6px 0 0',
                boxShadow: highlight ? '0 0 16px rgba(34,197,94,0.5)' : undefined,
                transition: 'height 0.6s cubic-bezier(0.34,1.56,0.64,1)',
                minHeight: d.count > 0 ? 6 : 0,
              }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ background: OPTION_COLORS[d.index], borderRadius: '0.25rem', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>{OPTION_LABELS[d.index]}</span>
              {highlight && <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>✓</span>}
            </div>
            {totalPlayers > 0 && <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{Math.round(d.count / totalPlayers * 100)}%</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function HostPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);

  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single();
    if (data) setRoom(data);
  }, [roomCode]);

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('game_players').select('*').eq('room_code', roomCode).order('score', { ascending: false });
    if (data) setPlayers(data);
  }, [roomCode]);

  const loadAnswers = useCallback(async (questionKey: string) => {
    const { data } = await supabase.from('game_answers').select('*').eq('room_code', roomCode).eq('question_key', questionKey);
    if (data) setAnswers(data);
  }, [roomCode]);

  useEffect(() => {
    loadRoom();
    loadPlayers();

    const roomSub = supabase.channel(`host-room-${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `room_code=eq.${roomCode}` }, () => loadRoom())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `room_code=eq.${roomCode}` }, () => loadPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_answers', filter: `room_code=eq.${roomCode}` }, async () => {
        if (room) {
          const key = room.mode === 'attack' ? `attack_${room.current_question_index}` : `quest_${room.current_scenario_id}`;
          loadAnswers(key);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(roomSub); };
  }, [loadRoom, loadPlayers, loadAnswers, room, roomCode]);

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timerActive, timeLeft]);

  async function updateRoom(updates: Partial<Room>) {
    await supabase.from('game_rooms').update(updates).eq('room_code', roomCode);
    setRoom(prev => prev ? { ...prev, ...updates } : prev);
  }

  async function startMode(mode: GameMode) {
    await updateRoom({ mode, status: 'lobby', current_question_index: 0 });
  }

  async function selectQuestion(idx: number) {
    await updateRoom({ current_question_index: idx, status: 'lobby' });
    setShowQuestionPicker(false);
    setAnswers([]);
  }

  async function startQuestion() {
    if (!room) return;
    const limit = room.mode === 'attack' ? 60 : 180;
    const now = new Date().toISOString();
    await updateRoom({ status: 'question', question_started_at: now });
    setTotalTime(limit);
    setTimeLeft(limit);
    setTimerActive(true);
    const key = room.mode === 'attack' ? `attack_${room.current_question_index}` : `quest_${room.current_scenario_id}`;
    setAnswers([]);
    await loadAnswers(key);
  }

  async function revealAnswer() {
    if (!room) return;
    setTimerActive(false);
    await updateRoom({ status: 'reveal' });

    const seed = roomCode + (room.mode === 'attack' ? room.current_question_index : room.current_scenario_id);

    if (room.mode === 'attack') {
      const shuffled = getShuffledAttackQuestion(room.current_question_index, room.difficulty || 'medium', seed);
      const key = `attack_${room.current_question_index}`;
      const { data: rawAnswers } = await supabase.from('game_answers').select('*').eq('room_code', roomCode).eq('question_key', key);
      if (rawAnswers) {
        for (const ans of rawAnswers) {
          const isCorrect = ans.answer_index === shuffled.correctIndex;
          const tier = getSpeedTier(ans.response_time_ms || 60000);
          const pts = isCorrect ? tier.points : 0;
          await supabase.from('game_answers').update({ is_correct: isCorrect, points_earned: pts }).eq('id', ans.id);
          if (pts > 0) {
            const player = players.find(p => p.id === ans.player_id);
            if (player) await supabase.from('game_players').update({ score: player.score + pts }).eq('id', ans.player_id);
          }
        }
        await loadAnswers(key);
        await loadPlayers();
      }
    } else if (room.mode === 'quest' && room.current_scenario_id) {
      const mcq = getQuestMCQ(room.current_scenario_id, room.difficulty || 'medium', seed);
      const key = `quest_${room.current_scenario_id}`;
      const { data: rawAnswers } = await supabase.from('game_answers').select('*').eq('room_code', roomCode).eq('question_key', key);
      if (rawAnswers) {
        for (const ans of rawAnswers) {
          try {
            const selected: number[] = JSON.parse(ans.answer_text || '[]');
            const numCorrect = selected.filter(i => mcq.correctIndices.includes(i)).length;
            const pts = numCorrect === 2 ? 100 : numCorrect === 1 ? 50 : 0;
            const isCorrect = numCorrect === 2;
            await supabase.from('game_answers').update({ is_correct: isCorrect, points_earned: pts }).eq('id', ans.id);
            if (pts > 0) {
              const player = players.find(p => p.id === ans.player_id);
              if (player) await supabase.from('game_players').update({ score: player.score + pts }).eq('id', ans.player_id);
            }
          } catch { /* skip */ }
        }
        await loadAnswers(key);
        await loadPlayers();
      }
    }
  }

  async function showExample() {
    await updateRoom({ status: 'reveal_example' });
  }

  async function showLeaderboard() {
    await loadPlayers();
    await updateRoom({ status: 'leaderboard' });
  }

  async function nextQuestion() {
    if (!room) return;
    if (room.mode === 'attack') {
      await updateRoom({ status: 'lobby' });
    } else {
      await updateRoom({ status: 'lobby', current_scenario_id: null });
    }
    setAnswers([]);
    setTimerActive(false);
    setTimeLeft(0);
  }

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) return <div style={{ color: '#fff', textAlign: 'center', padding: '3rem', fontSize: '1.5rem' }}>Loading room...</div>;

  const seed = roomCode + (room.mode === 'attack' ? room.current_question_index : room.current_scenario_id);
  const diff: Difficulty = room.difficulty || 'medium';
  const shuffledQ = room.mode === 'attack' ? getShuffledAttackQuestion(room.current_question_index, diff, seed) : null;
  const questMCQ = room.mode === 'quest' && room.current_scenario_id ? getQuestMCQ(room.current_scenario_id, diff, seed) : null;
  const currentScenario = room.mode === 'quest' && room.current_scenario_id ? CYBER_QUEST_SCENARIOS.find(s => s.id === room.current_scenario_id) : null;
  const sector = SECTORS.find(s => s.id === room.sector);
  const nonHostPlayers = players.filter(p => !p.is_host);
  const now = Date.now();
  const activePlayers = nonHostPlayers.filter(p => p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 60000);
  const answerCount = answers.length;
  const answerDistribution = shuffledQ ? [0, 1, 2, 3].map(i => ({
    index: i, count: answers.filter(a => a.answer_index === i).length, isCorrect: i === shuffledQ.correctIndex,
  })) : [];

  const diffCfg: Record<Difficulty, { label: string; color: string; desc: string }> = {
    easy:   { label: 'Easy',   color: '#22c55e', desc: 'Obvious distractors' },
    medium: { label: 'Medium', color: '#f97316', desc: 'Some plausible distractors' },
    hard:   { label: 'Hard',   color: '#ef4444', desc: 'All options sound correct' },
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* End Game button — always pinned bottom-right */}
      {room.status !== 'ended' && (
        <button onClick={() => { if (confirm('End the game for all players?')) updateRoom({ status: 'ended' }); }}
          style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 100, background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', color: '#f87171', borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.35)'; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}>
          🏁 End Game
        </button>
      )}

      {/* Top bar */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.875rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/csa-logo.svg" alt="CSA" style={{ height: 36, opacity: 0.92 }} />
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1rem' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>CYBER ESSENTIALS IN ACTION</div>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{sector?.icon} {sector?.label} · Facilitator</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={copyCode} style={{ background: 'rgba(99,102,241,0.2)', border: '2px solid #6366f1', borderRadius: '0.5rem', color: '#a5b4fc', fontSize: '1.3rem', fontWeight: 900, letterSpacing: '0.15em', padding: '0.25rem 0.75rem', cursor: 'pointer' }}>
            {roomCode} {copied ? '✓' : '📋'}
          </button>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '0.75rem', padding: '0.4rem 0.875rem', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>Active / Total</div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>
              <span style={{ color: '#22c55e' }}>{activePlayers.length}</span>
              <span style={{ color: '#475569' }}>/{nonHostPlayers.length}</span>
            </div>
          </div>
          <div style={{ background: `${diffCfg[diff].color}20`, border: `1px solid ${diffCfg[diff].color}50`, borderRadius: '0.75rem', padding: '0.4rem 0.875rem', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>Difficulty</div>
            <div style={{ fontWeight: 800, color: diffCfg[diff].color }}>{diffCfg[diff].label}</div>
          </div>
          {timerActive && timeLeft > 0 && <CircularTimer timeLeft={timeLeft} totalTime={totalTime} />}
        </div>
      </div>

      {/* ── Join Banner — always visible so players can scan/click to join ── */}
      {room.status !== 'ended' && (
        <div style={{ background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.2)', padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* QR code pointing to the join URL with code pre-filled */}
          {typeof window !== 'undefined' && (() => {
            const joinUrl = `${window.location.origin}/game?code=${roomCode}`;
            const qr = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(joinUrl)}&margin=2&bgcolor=ffffff`;
            return (
              <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '4px', display: 'inline-block', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Join QR" width={80} height={80} style={{ display: 'block', borderRadius: '0.25rem' }} />
              </div>
            );
          })()}
          <div>
            <div style={{ color: '#a5b4fc', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>📱 Players — Scan QR Code to visit:</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
              {typeof window !== 'undefined' ? `${window.location.host}/game` : '/game'}
              <span style={{ color: '#6366f1', marginLeft: '0.4rem' }}>→ enter code</span>
              <span style={{ background: '#6366f1', color: '#fff', borderRadius: '0.4rem', padding: '0.1rem 0.55rem', marginLeft: '0.5rem', letterSpacing: '0.2em', fontSize: '1.05rem', fontFamily: 'monospace' }}>{roomCode}</span>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Simply type in your name and click Join Game (room code auto-filled)</div>
          </div>
        </div>
      )}

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── LOBBY ── */}
        {room.status === 'lobby' && !room.current_scenario_id && (
          <>
            {/* Mode + Difficulty row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Game Mode</h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <ModeCard active={room.mode === 'attack'} icon="⚡" title="Cyber Attack" subtitle="Pick any of 24 questions · Max 100 pts/question" color="#f97316" onClick={() => startMode('attack')} />
                  <ModeCard active={room.mode === 'quest'} icon="🎭" title="Cyber Quest" subtitle="9 scenarios · MCQ · Auto-scored" color="#22c55e" onClick={() => startMode('quest')} />
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.25rem', minWidth: 210 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>⚙️ Difficulty</div>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
                  const cfg = diffCfg[d];
                  const active = diff === d;
                  return (
                    <button key={d} onClick={() => updateRoom({ difficulty: d })}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', background: active ? `${cfg.color}20` : 'rgba(255,255,255,0.03)', border: `2px solid ${active ? cfg.color : 'transparent'}`, borderRadius: '0.5rem', padding: '0.55rem 0.875rem', cursor: 'pointer', color: '#fff', marginBottom: '0.35rem', textAlign: 'left', transition: 'all 0.15s' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, color: active ? cfg.color : '#e2e8f0', fontSize: '0.875rem' }}>{cfg.label}</div>
                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{cfg.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attack: question picker */}
            {room.mode === 'attack' && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⚡ Question {room.current_question_index + 1} of {CYBER_ATTACK_QUESTIONS.length}</h3>
                    {shuffledQ && <span style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', borderRadius: '0.375rem', padding: '0.15rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem', display: 'inline-block' }}>{shuffledQ.pillar}</span>}
                  </div>
                  <button onClick={() => setShowQuestionPicker(p => !p)}
                    style={{ background: 'rgba(99,102,241,0.2)', border: '2px solid rgba(99,102,241,0.4)', color: '#a5b4fc', borderRadius: '0.625rem', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                    {showQuestionPicker ? '✕ Close Picker' : '📋 Pick a Question'}
                  </button>
                </div>

                {/* Question picker drawer */}
                {showQuestionPicker && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '1rem', padding: '1rem', marginBottom: '1rem', maxHeight: 320, overflowY: 'auto' }}>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Select any question to jump to it:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {CYBER_ATTACK_QUESTIONS.map((q, i) => {
                        const isSelected = i === room.current_question_index;
                        return (
                          <button key={i} onClick={() => selectQuestion(i)}
                            style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.08)'}`, borderRadius: '0.625rem', padding: '0.6rem 0.875rem', cursor: 'pointer', color: '#fff', textAlign: 'left', transition: 'all 0.1s' }}
                            onMouseOver={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                            onMouseOut={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}>
                            <span style={{ background: isSelected ? '#6366f1' : 'rgba(255,255,255,0.1)', borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>Q{i + 1}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.82rem', color: isSelected ? '#a5b4fc' : '#94a3b8', fontWeight: 600, marginBottom: '0.15rem' }}>{q.pillar} · {q.category}</div>
                              <div style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.4 }}>{q.question.length > 90 ? q.question.slice(0, 90) + '…' : q.question}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Question preview */}
                {shuffledQ && !showQuestionPicker && (
                  <>
                    <p style={{ fontSize: '1.2rem', color: '#e2e8f0', marginBottom: '1.25rem', lineHeight: 1.5 }}>{shuffledQ.question}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1.25rem' }}>
                      {shuffledQ.options.map((opt, i) => (
                        <div key={i} style={{ background: i === shuffledQ.correctIndex ? 'rgba(34,197,94,0.15)' : `${OPTION_COLORS[i]}12`, border: `2px solid ${i === shuffledQ.correctIndex ? '#22c55e60' : OPTION_COLORS[i] + '40'}`, borderRadius: '0.75rem', padding: '0.7rem 1rem', display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                          <span style={{ background: OPTION_COLORS[i], borderRadius: '0.3rem', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0, fontSize: '0.8rem' }}>{OPTION_LABELS[i]}</span>
                          <span style={{ fontSize: '0.9rem' }}>{opt}</span>
                          {i === shuffledQ.correctIndex && <span style={{ marginLeft: 'auto', color: '#4ade80' }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={startQuestion} style={greenBtn}>▶ Start (1 min ⏱)</button>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{nonHostPlayers.length} players · max {nonHostPlayers.length * 100} pts this round</span>
                </div>
              </div>
            )}

            {/* Quest: scenario picker */}
            {room.mode === 'quest' && (
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>🎭 Choose a Scenario</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {CYBER_QUEST_SCENARIOS.map(scenario => (
                    <button key={scenario.id} onClick={() => updateRoom({ current_scenario_id: scenario.id, status: 'lobby' })}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'all 0.15s' }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.2)'; (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '2rem' }}>{scenario.icon}</span>
                        <span style={{ background: '#1e293b', borderRadius: '0.375rem', padding: '0.1rem 0.4rem', fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>{scenario.id}</span>
                      </div>
                      <div style={{ fontWeight: 700, marginTop: '0.5rem', fontSize: '0.95rem' }}>{scenario.label}</div>
                      {scenario.aiEdition && <div style={{ color: '#a78bfa', fontSize: '0.75rem', marginTop: '0.2rem' }}>🤖 AI Edition</div>}
                      <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.25rem', lineHeight: 1.4 }}>{scenario.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Players */}
            <div style={{ ...card, marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>👥 Players ({nonHostPlayers.length})</h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  <span style={{ color: '#22c55e' }}>●</span> Active: {activePlayers.length} &nbsp;
                  <span style={{ color: '#475569' }}>●</span> Away: {nonHostPlayers.length - activePlayers.length}
                </span>
              </div>
              {nonHostPlayers.length === 0
                ? <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>Waiting for players… share code <strong style={{ color: '#a5b4fc' }}>{roomCode}</strong></div>
                : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                    {nonHostPlayers.map(p => {
                      const isActive = p.last_seen_at && (now - new Date(p.last_seen_at).getTime() < 60000);
                      return (
                        <div key={p.id} style={{ background: `${p.avatar_color}18`, border: `1px solid ${isActive ? p.avatar_color + '70' : 'rgba(255,255,255,0.08)'}`, borderRadius: '2rem', padding: '0.35rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: isActive ? 1 : 0.45 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#22c55e' : '#475569', display: 'inline-block' }} />
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.player_name}</span>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          </>
        )}

        {/* Quest: scenario preview before start */}
        {room.status === 'lobby' && room.mode === 'quest' && currentScenario && questMCQ && (
          <QuestScenarioView scenario={currentScenario} status="lobby" mcq={questMCQ} onStart={startQuestion} playerCount={nonHostPlayers.length} />
        )}

        {/* Attack: live question — bars update in real-time, no correct answer revealed yet */}
        {room.mode === 'attack' && room.status === 'question' && shuffledQ && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>⚡ Q{room.current_question_index + 1} · {shuffledQ.category}</span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>{answerCount}/{nonHostPlayers.length} answered</span>
                <button onClick={revealAnswer} style={orangeBtn}>⏩ Reveal Answer</button>
              </div>
            </div>
            <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1.25rem', lineHeight: 1.4 }}>{shuffledQ.question}</p>
            <VerticalBarChart distribution={answerDistribution} totalPlayers={nonHostPlayers.length} showCorrect={false} />
          </div>
        )}

        {/* Quest: live MCQ */}
        {room.mode === 'quest' && room.status === 'question' && currentScenario && questMCQ && (
          <QuestScenarioView scenario={currentScenario} status="question" mcq={questMCQ} onReveal={revealAnswer} playerCount={nonHostPlayers.length} answerCount={answerCount} />
        )}

        {/* Reveal — stage 1: results + bar chart, no example yet */}
        {(room.status === 'reveal' || room.status === 'reveal_example') && (
          <>
            {room.mode === 'attack' && shuffledQ && (
              <div style={card}>
                <h3 style={{ color: '#22c55e', fontSize: '1.2rem', marginBottom: '1rem' }}>✅ Answer Revealed — Q{room.current_question_index + 1}</h3>

                {/* Correct answer */}
                <div style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' }}>CORRECT ANSWER</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{OPTION_LABELS[shuffledQ.correctIndex]}. {shuffledQ.options[shuffledQ.correctIndex]}</div>
                </div>

                {/* Bar chart — shown first, with correct highlighted */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.75rem' }}>📊 Response distribution:</p>
                  <VerticalBarChart distribution={answerDistribution} totalPlayers={nonHostPlayers.length} showCorrect={true} />
                </div>

                {/* Speed breakdown */}
                {answers.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>⚡ Speed breakdown:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {[...answers].sort((a, b) => (a.response_time_ms || 60000) - (b.response_time_ms || 60000)).map(ans => {
                        const p = players.find(pl => pl.id === ans.player_id);
                        const tier = getSpeedTier(ans.response_time_ms || 60000);
                        return (
                          <div key={ans.id} style={{ background: `${tier.color}18`, border: `1px solid ${tier.color}40`, borderRadius: '0.625rem', padding: '0.35rem 0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem' }}>
                            <span>{tier.emoji}</span>
                            <span style={{ fontWeight: 600 }}>{p?.player_name || '?'}</span>
                            <span style={{ color: '#64748b' }}>{((ans.response_time_ms || 0) / 1000).toFixed(1)}s</span>
                            {ans.is_correct && <span style={{ color: '#4ade80', fontWeight: 700 }}>+{ans.points_earned}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Explanation */}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem', color: '#94a3b8', lineHeight: 1.6 }}>💡 {shuffledQ.explanation}</div>
                {shuffledQ.funFact && <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#a5b4fc', fontSize: '0.9rem' }}>🤓 {shuffledQ.funFact}</div>}

                {/* Real-world example — shown only after facilitator clicks "Show Example" */}
                {room.status === 'reveal_example' && (
                  <QuestionExample questionId={CYBER_ATTACK_QUESTIONS[room.current_question_index]?.id} />
                )}

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '2rem' }}>
                  {room.status === 'reveal' && hasExample(CYBER_ATTACK_QUESTIONS[room.current_question_index]?.id) && (
                    <button onClick={showExample} style={{ ...orangeBtn, flex: '1 1 auto' }}>📸 Show Real-World Example</button>
                  )}
                  <button onClick={showLeaderboard} style={greenBtn}>📊 Leaderboard</button>
                  <button onClick={nextQuestion} style={grayBtn}>⏭ Next Question</button>
                </div>
              </div>
            )}

            {room.mode === 'quest' && currentScenario && questMCQ && (
              <div style={card}>
                <h3 style={{ color: '#22c55e', fontSize: '1.2rem', marginBottom: '1rem' }}>🎭 Debrief: {currentScenario.label}</h3>

                {/* Correct answers */}
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.5rem' }}>✅ Correct Answers</div>
                  {questMCQ.correctIndices.map(ci => <div key={ci} style={{ color: '#d1fae5', marginBottom: '0.3rem', fontSize: '0.9rem' }}>• {questMCQ.options[ci]}</div>)}
                </div>

                {/* Quest response grid */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Player responses:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                    {nonHostPlayers.map(p => {
                      const ans = answers.find(a => a.player_id === p.id);
                      const status = !ans ? 'none' : ans.is_correct ? 'correct' : ans.points_earned > 0 ? 'half' : 'wrong';
                      const statusColor = status === 'correct' ? '#22c55e' : status === 'half' ? '#f97316' : status === 'wrong' ? '#ef4444' : '#475569';
                      const statusLabel = status === 'correct' ? '✓ Both' : status === 'half' ? '½ One' : status === 'wrong' ? '✗ Wrong' : 'No answer';
                      return (
                        <div key={p.id} style={{ background: `${statusColor}15`, border: `2px solid ${statusColor}40`, borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.avatar_color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.player_name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: statusColor, fontWeight: 700, fontSize: '0.82rem' }}>{statusLabel}</span>
                            {ans && <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem' }}>+{ans.points_earned}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* All protection tips */}
                <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.5rem' }}>🛡️ All Protection Measures</div>
                  {currentScenario.protectionTips.map((tip, i) => <div key={i} style={{ color: '#d1fae5', fontSize: '0.88rem', marginBottom: '0.3rem' }}>• {tip}</div>)}
                </div>

                {/* Real-world example (scenario animation) — shown only after facilitator clicks */}
                {room.status === 'reveal_example' && currentScenario && (
                  <div style={{ marginBottom: '1rem' }}>
                    <ScenarioAnimation scenarioId={currentScenario.id} label={currentScenario.label} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {room.status === 'reveal' && (
                    <button onClick={showExample} style={{ ...orangeBtn, flex: '1 1 auto' }}>📸 Show Real-World Example</button>
                  )}
                  <button onClick={showLeaderboard} style={greenBtn}>📊 Leaderboard</button>
                  <button onClick={nextQuestion} style={grayBtn}>🎭 Next Scenario</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Leaderboard */}
        {room.status === 'leaderboard' && (
          <div style={card}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '2rem' }}>🏆 Leaderboard</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 500, margin: '0 auto 2rem' }}>
              {[...nonHostPlayers].sort((a, b) => b.score - a.score).slice(0, 10).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: i === 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'transparent'}` }}>
                  <span style={{ fontSize: '1.4rem', width: 34 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                  <span style={{ fontWeight: 700, flex: 1 }}>{p.player_name}</span>
                  <span style={{ fontWeight: 800, fontSize: '1.25rem', color: i === 0 ? '#fbbf24' : '#e2e8f0' }}>{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {room.mode === 'attack' && <button onClick={nextQuestion} style={greenBtn}>⚡ Next Question</button>}
              {room.mode === 'quest' && <button onClick={nextQuestion} style={greenBtn}>🎭 Next Scenario</button>}
              <button onClick={() => updateRoom({ status: 'ended' })} style={grayBtn}>🏁 End Game</button>
            </div>
          </div>
        )}

        {/* Ended */}
        {room.status === 'ended' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Game Over — Final Standings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 500, margin: '0 auto 2rem' }}>
              {[...nonHostPlayers].sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem' }}>
                  <span style={{ width: 28, textAlign: 'center', fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                  <span style={{ fontWeight: 700, flex: 1 }}>{p.player_name}</span>
                  <span style={{ fontWeight: 800, color: '#fbbf24' }}>{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/game" style={{ ...greenBtn, display: 'inline-block', textDecoration: 'none' }}>🏠 New Game</a>
              <a href="/game/resources" target="_blank" style={{ ...grayBtn, display: 'inline-block', textDecoration: 'none', background: 'rgba(200,16,46,0.2)', borderColor: '#C8102E' }}>🛡️ CSA Resources &amp; QR Codes</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeCard({ active, icon, title, subtitle, color, onClick }: { active: boolean; icon: string; title: string; subtitle: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flex: '1 1 200px', background: active ? `${color}20` : 'rgba(255,255,255,0.05)', border: `3px solid ${active ? color : 'rgba(255,255,255,0.1)'}`, borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'all 0.15s' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: active ? color : '#e2e8f0' }}>{title}</div>
      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.2rem' }}>{subtitle}</div>
      {active && <div style={{ marginTop: '0.5rem', color: color, fontSize: '0.8rem', fontWeight: 700 }}>✓ Selected</div>}
    </button>
  );
}

function QuestScenarioView({ scenario, status, mcq, onStart, onReveal, playerCount, answerCount }: {
  scenario: QuestScenario; status: GameStatus;
  mcq: { question: string; options: string[]; correctIndices: number[] };
  onStart?: () => void; onReveal?: () => void; playerCount?: number; answerCount?: number;
}) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '3rem' }}>{scenario.icon}</span>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontSize: '0.82rem', fontWeight: 700 }}>Scenario {scenario.id}</span>
            {scenario.aiEdition && <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontSize: '0.78rem', fontWeight: 700 }}>🤖 AI Edition</span>}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#e2e8f0' }}>{scenario.label}</h2>
          <p style={{ color: '#fb923c', fontWeight: 600, margin: '0.2rem 0 0' }}>{scenario.subtitle}</p>
        </div>
      </div>
      {/* Animated scenario simulation — autoplays as soon as scenario loads */}
      <div style={{ marginBottom: '1.25rem' }}>
        <ScenarioAnimation scenarioId={scenario.id} label={scenario.label} />
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <p style={{ color: '#e2e8f0', margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>{scenario.description}</p>
      </div>
      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ color: '#a5b4fc', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.65rem' }}>MCQ PLAYERS WILL SEE · Select 2 correct answers</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {mcq.options.map((opt, i) => (
            <div key={i} style={{ background: mcq.correctIndices.includes(i) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${mcq.correctIndices.includes(i) ? '#22c55e50' : 'rgba(255,255,255,0.08)'}`, borderRadius: '0.5rem', padding: '0.45rem 0.75rem', fontSize: '0.82rem', display: 'flex', gap: '0.4rem' }}>
              <span style={{ color: mcq.correctIndices.includes(i) ? '#4ade80' : '#64748b', fontWeight: 700, flexShrink: 0 }}>{['A','B','C','D'][i]}{mcq.correctIndices.includes(i) ? '✓' : ''}</span>
              <span>{opt}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {status === 'lobby' && onStart && <button onClick={onStart} style={greenBtn}>▶ Start (3 min ⏱)</button>}
        {status === 'question' && onReveal && (
          <>
            <button onClick={onReveal} style={orangeBtn}>⏩ Reveal & Auto-Score</button>
            <span style={{ color: '#64748b' }}>{answerCount || 0}/{playerCount || 0} answered</span>
          </>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', padding: '1.5rem', marginBottom: '1.5rem' };
const greenBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' };
const orangeBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' };
const grayBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' };
