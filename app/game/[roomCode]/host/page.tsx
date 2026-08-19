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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

type GameMode = 'attack' | 'quest';
type GameStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

interface Player { id: string; player_name: string; score: number; avatar_color: string; is_host: boolean; last_seen_at: string | null; }
interface Room { room_code: string; sector: string; mode: GameMode; status: GameStatus; current_question_index: number; current_scenario_id: string | null; question_started_at: string | null; difficulty: Difficulty; }
interface Answer { player_id: string; answer_index: number | null; answer_text: string | null; is_correct: boolean | null; points_earned: number; }

const OPTION_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function HostPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function startQuestion() {
    if (!room) return;
    const now = new Date().toISOString();
    const timeLimitSec = room.mode === 'attack' ? 60 : 180;
    await updateRoom({ status: 'question', question_started_at: now });
    setTimeLeft(timeLimitSec);
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
          const timeSec = (ans.response_time_ms || 0) / 1000;
          const timeBonus = Math.floor(500 * Math.max(0, 1 - timeSec / 60));
          const pts = isCorrect ? 1000 + timeBonus : 0;
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
      // Auto-score quest MCQ
      const mcq = getQuestMCQ(room.current_scenario_id, room.difficulty || 'medium', seed);
      const key = `quest_${room.current_scenario_id}`;
      const { data: rawAnswers } = await supabase.from('game_answers').select('*').eq('room_code', roomCode).eq('question_key', key);
      if (rawAnswers) {
        for (const ans of rawAnswers) {
          try {
            const selected: number[] = JSON.parse(ans.answer_text || '[]');
            const numCorrect = selected.filter(i => mcq.correctIndices.includes(i)).length;
            const pts = numCorrect === 2 ? 500 : numCorrect === 1 ? 200 : 0;
            const isCorrect = numCorrect === 2;
            await supabase.from('game_answers').update({ is_correct: isCorrect, points_earned: pts }).eq('id', ans.id);
            if (pts > 0) {
              const player = players.find(p => p.id === ans.player_id);
              if (player) await supabase.from('game_players').update({ score: player.score + pts }).eq('id', ans.player_id);
            }
          } catch { /* skip invalid */ }
        }
        await loadAnswers(key);
        await loadPlayers();
      }
    }
  }

  async function showLeaderboard() {
    await loadPlayers();
    await updateRoom({ status: 'leaderboard' });
  }

  async function nextQuestion() {
    if (!room) return;
    if (room.mode === 'attack') {
      const nextIdx = room.current_question_index + 1;
      if (nextIdx >= CYBER_ATTACK_QUESTIONS.length) {
        await updateRoom({ status: 'ended' });
      } else {
        await updateRoom({ status: 'lobby', current_question_index: nextIdx });
      }
    } else {
      await updateRoom({ status: 'lobby', current_scenario_id: null });
    }
    setAnswers([]);
  }

  async function startQuestScenario(scenarioId: string) {
    await updateRoom({ current_scenario_id: scenarioId, status: 'lobby' });
  }

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) return <div style={{ color: '#fff', textAlign: 'center', padding: '3rem', fontSize: '1.5rem' }}>Loading room...</div>;

  const seed = roomCode + (room.mode === 'attack' ? room.current_question_index : room.current_scenario_id);
  const shuffledQ = room.mode === 'attack' ? getShuffledAttackQuestion(room.current_question_index, room.difficulty || 'medium', seed) : null;
  const questMCQ = room.mode === 'quest' && room.current_scenario_id ? getQuestMCQ(room.current_scenario_id, room.difficulty || 'medium', seed) : null;
  const currentScenario = room.mode === 'quest' && room.current_scenario_id ? CYBER_QUEST_SCENARIOS.find(s => s.id === room.current_scenario_id) : null;
  const sector = SECTORS.find(s => s.id === room.sector);
  const nonHostPlayers = players.filter(p => !p.is_host);
  const now = Date.now();
  const activePlayers = nonHostPlayers.filter(p => p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 60000);
  const inactivePlayers = nonHostPlayers.filter(p => !p.last_seen_at || now - new Date(p.last_seen_at).getTime() >= 60000);
  const answerCount = answers.length;
  const answerDistribution = shuffledQ ? [0, 1, 2, 3].map(i => ({
    index: i,
    count: answers.filter(a => a.answer_index === i).length,
    isCorrect: i === shuffledQ.correctIndex,
  })) : [];

  const difficultyConfig: Record<Difficulty, { label: string; color: string; desc: string }> = {
    easy:   { label: 'Easy',   color: '#22c55e', desc: 'Obvious wrong answers — great for beginners' },
    medium: { label: 'Medium', color: '#f97316', desc: 'Some plausible distractors — balanced' },
    hard:   { label: 'Hard',   color: '#ef4444', desc: 'All options sound correct — for experts' },
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Persistent End Game button */}
      {room.status !== 'ended' && (
        <button
          onClick={() => { if (confirm('End the game for all players?')) updateRoom({ status: 'ended' }); }}
          style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 100, background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', color: '#f87171', borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.35)'; (e.currentTarget as HTMLElement).style.borderColor = '#ef4444'; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)'; }}
        >
          🏁 End Game
        </button>
      )}

      {/* Top bar */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/csa-logo.svg" alt="CSA" style={{ height: 36, opacity: 0.92 }} />
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1rem' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>CYBER ESSENTIALS IN ACTION</div>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{sector?.icon} {sector?.label} · Facilitator View</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Room Code</div>
            <button onClick={copyCode} style={{ background: 'rgba(99,102,241,0.2)', border: '2px solid #6366f1', borderRadius: '0.5rem', color: '#a5b4fc', fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.15em', padding: '0.25rem 0.75rem', cursor: 'pointer' }}>
              {roomCode} {copied ? '✓' : '📋'}
            </button>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '0.75rem', padding: '0.5rem 1rem', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Active / Total</div>
            <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>
              <span style={{ color: '#22c55e' }}>{activePlayers.length}</span>
              <span style={{ color: '#475569' }}>/{nonHostPlayers.length}</span>
            </div>
          </div>
          {/* Difficulty badge */}
          <div style={{ background: `${difficultyConfig[room.difficulty || 'medium'].color}20`, border: `1px solid ${difficultyConfig[room.difficulty || 'medium'].color}50`, borderRadius: '0.75rem', padding: '0.5rem 1rem', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Difficulty</div>
            <div style={{ fontWeight: 800, color: difficultyConfig[room.difficulty || 'medium'].color }}>{difficultyConfig[room.difficulty || 'medium'].label}</div>
          </div>
          {timerActive && timeLeft > 0 && (
            <div style={{ background: timeLeft <= 10 ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.2)', borderRadius: '0.75rem', padding: '0.5rem 1rem', textAlign: 'center', minWidth: 70 }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Time</div>
              <div style={{ fontWeight: 800, fontSize: '1.8rem', color: timeLeft <= 10 ? '#ef4444' : '#a5b4fc' }}>{timeLeft}s</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>

        {/* LOBBY */}
        {room.status === 'lobby' && !room.current_scenario_id && (
          <>
            {/* Mode + Difficulty selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', marginBottom: '2rem', alignItems: 'start' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem' }}>Game Mode</h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <ModeCard active={room.mode === 'attack'} icon="⚡" title="Cyber Attack" subtitle="24 MCQ · 1 min · Speed scoring" color="#f97316" onClick={() => startMode('attack')} />
                  <ModeCard active={room.mode === 'quest'} icon="🎭" title="Cyber Quest" subtitle="9 scenarios · MCQ · 3 min each" color="#22c55e" onClick={() => startMode('quest')} />
                </div>
              </div>
              <div style={{ ...card, minWidth: 220 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.95rem' }}>⚙️ Difficulty</div>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
                  const cfg = difficultyConfig[d];
                  const isActive = (room.difficulty || 'medium') === d;
                  return (
                    <button key={d} onClick={() => updateRoom({ difficulty: d })}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', background: isActive ? `${cfg.color}20` : 'rgba(255,255,255,0.04)', border: `2px solid ${isActive ? cfg.color : 'transparent'}`, borderRadius: '0.5rem', padding: '0.6rem 0.875rem', cursor: 'pointer', color: '#fff', marginBottom: '0.4rem', textAlign: 'left', transition: 'all 0.15s' }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, color: isActive ? cfg.color : '#e2e8f0', fontSize: '0.9rem' }}>{cfg.label}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{cfg.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attack: preview question */}
            {room.mode === 'attack' && shuffledQ && (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>⚡ Question {room.current_question_index + 1} of {CYBER_ATTACK_QUESTIONS.length}</h3>
                  <span style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', borderRadius: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{shuffledQ.pillar}</span>
                </div>
                <p style={{ fontSize: '1.3rem', color: '#e2e8f0', marginBottom: '1.5rem', lineHeight: 1.5 }}>{shuffledQ.question}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {shuffledQ.options.map((opt, i) => (
                    <div key={i} style={{ background: i === shuffledQ.correctIndex ? 'rgba(34,197,94,0.15)' : `${OPTION_COLORS[i]}15`, border: `2px solid ${i === shuffledQ.correctIndex ? '#22c55e60' : OPTION_COLORS[i] + '40'}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ background: OPTION_COLORS[i], borderRadius: '0.375rem', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{OPTION_LABELS[i]}</span>
                      <span style={{ fontSize: '0.95rem' }}>{opt}</span>
                      {i === shuffledQ.correctIndex && <span style={{ marginLeft: 'auto', color: '#4ade80', fontSize: '1rem' }}>✓</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={startQuestion} style={greenBtn}>▶ Start Question (1 min)</button>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{nonHostPlayers.length} players waiting</span>
                </div>
              </div>
            )}

            {/* Quest: scenario picker */}
            {room.mode === 'quest' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>🎭 Choose a Scenario</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {CYBER_QUEST_SCENARIOS.map(scenario => (
                    <button key={scenario.id} onClick={() => startQuestScenario(scenario.id)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'all 0.15s' }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.2)'; (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '2rem' }}>{scenario.icon}</span>
                        <span style={{ background: '#1e293b', borderRadius: '0.375rem', padding: '0.1rem 0.4rem', fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>{scenario.id}</span>
                      </div>
                      <div style={{ fontWeight: 700, marginTop: '0.5rem', fontSize: '1rem' }}>{scenario.label}</div>
                      {scenario.aiEdition && <div style={{ color: '#a78bfa', fontSize: '0.75rem', marginTop: '0.25rem' }}>🤖 AI Edition</div>}
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem', lineHeight: 1.4 }}>{scenario.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Player list */}
            <div style={{ ...card, marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>👥 Players ({nonHostPlayers.length})</h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                  <span><span style={{ color: '#22c55e' }}>●</span> Active: {activePlayers.length}</span>
                  <span><span style={{ color: '#475569' }}>●</span> Away: {inactivePlayers.length}</span>
                </div>
              </div>
              {nonHostPlayers.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
                  Waiting for players to join...<br />
                  <span style={{ fontSize: '0.9rem' }}>Share the room code: <strong style={{ color: '#a5b4fc' }}>{roomCode}</strong></span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {nonHostPlayers.map(p => {
                    const isActive = p.last_seen_at && (now - new Date(p.last_seen_at).getTime() < 60000);
                    return (
                      <div key={p.id} style={{ background: `${p.avatar_color}20`, border: `1px solid ${isActive ? p.avatar_color + '80' : 'rgba(255,255,255,0.08)'}`, borderRadius: '2rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isActive ? 1 : 0.45 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#22c55e' : '#475569', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{p.player_name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Quest: scenario preview before starting */}
        {room.status === 'lobby' && room.mode === 'quest' && currentScenario && questMCQ && (
          <div>
            <QuestScenarioView scenario={currentScenario} status="lobby" mcq={questMCQ} onStart={startQuestion} playerCount={nonHostPlayers.length} />
          </div>
        )}

        {/* Attack: live question view */}
        {room.mode === 'attack' && room.status === 'question' && shuffledQ && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>⚡ Q{room.current_question_index + 1} · {shuffledQ.category}</span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{answerCount}/{nonHostPlayers.length} answered</span>
                <button onClick={revealAnswer} style={orangeBtn}>⏩ Reveal Answer</button>
              </div>
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1.5rem', lineHeight: 1.4 }}>{shuffledQ.question}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {answerDistribution.map(d => (
                <div key={d.index} style={{ background: `${OPTION_COLORS[d.index]}15`, border: `2px solid ${OPTION_COLORS[d.index]}40`, borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: OPTION_COLORS[d.index] }}>{OPTION_LABELS[d.index]}</span>
                    <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{d.count}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6 }}>
                    <div style={{ height: '100%', background: OPTION_COLORS[d.index], borderRadius: 3, width: nonHostPlayers.length > 0 ? `${(d.count / nonHostPlayers.length) * 100}%` : '0%', transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quest: live MCQ view */}
        {room.mode === 'quest' && room.status === 'question' && currentScenario && questMCQ && (
          <QuestScenarioView scenario={currentScenario} status="question" mcq={questMCQ} onReveal={revealAnswer} playerCount={nonHostPlayers.length} answerCount={answerCount} />
        )}

        {/* Reveal */}
        {room.status === 'reveal' && (
          <div>
            {room.mode === 'attack' && shuffledQ && (
              <div style={card}>
                <h3 style={{ color: '#22c55e', fontSize: '1.2rem', marginBottom: '1rem' }}>✅ Answer Revealed</h3>
                <p style={{ fontSize: '1.3rem', color: '#e2e8f0', marginBottom: '1rem' }}>{shuffledQ.question}</p>
                <div style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>CORRECT ANSWER</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{OPTION_LABELS[shuffledQ.correctIndex]}. {shuffledQ.options[shuffledQ.correctIndex]}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>💡 {shuffledQ.explanation}</div>
                {shuffledQ.funFact && <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', marginBottom: '1rem', color: '#a5b4fc', fontSize: '0.9rem' }}>🤓 {shuffledQ.funFact}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {answerDistribution.map(d => (
                    <div key={d.index} style={{ background: d.isCorrect ? 'rgba(34,197,94,0.15)' : `${OPTION_COLORS[d.index]}15`, border: `2px solid ${d.isCorrect ? '#22c55e' : OPTION_COLORS[d.index] + '40'}`, borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: d.isCorrect ? '#22c55e' : OPTION_COLORS[d.index] }}>{OPTION_LABELS[d.index]} {d.isCorrect ? '✓' : ''}</span>
                        <span style={{ fontWeight: 700 }}>{d.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={showLeaderboard} style={greenBtn}>📊 Show Leaderboard</button>
                  <button onClick={nextQuestion} style={grayBtn}>⏭ Next Question</button>
                </div>
              </div>
            )}
            {room.mode === 'quest' && currentScenario && questMCQ && (
              <div style={card}>
                <h3 style={{ color: '#22c55e', fontSize: '1.2rem', marginBottom: '1rem' }}>🎭 Debrief: {currentScenario.label}</h3>
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.75rem' }}>✅ Correct Answers</div>
                  {questMCQ.correctIndices.map(ci => (
                    <div key={ci} style={{ color: '#d1fae5', marginBottom: '0.4rem', fontSize: '0.95rem' }}>• {questMCQ.options[ci]}</div>
                  ))}
                </div>
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.5rem' }}>🛡️ All Protection Measures</div>
                  {currentScenario.protectionTips.map((tip, i) => <div key={i} style={{ color: '#d1fae5', fontSize: '0.9rem', marginBottom: '0.3rem' }}>• {tip}</div>)}
                </div>
                {/* Score summary */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>RESULTS</div>
                  {nonHostPlayers.map(p => {
                    const ans = answers.find(a => a.player_id === p.id);
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                          <span style={{ fontWeight: 600 }}>{p.player_name}</span>
                        </div>
                        {ans ? (
                          <span style={{ fontWeight: 700, color: ans.is_correct ? '#4ade80' : ans.points_earned > 0 ? '#fb923c' : '#64748b' }}>
                            {ans.is_correct ? '✓ Both correct' : ans.points_earned > 0 ? '½ One correct' : '✗ None'} · +{ans.points_earned} pts
                          </span>
                        ) : <span style={{ color: '#64748b' }}>No answer</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={showLeaderboard} style={greenBtn}>📊 Show Leaderboard</button>
                  <button onClick={nextQuestion} style={grayBtn}>🎭 Choose Another Scenario</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {room.status === 'leaderboard' && (
          <div style={card}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '2rem' }}>🏆 Leaderboard</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 500, margin: '0 auto 2rem' }}>
              {[...nonHostPlayers].sort((a, b) => b.score - a.score).slice(0, 10).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: i === 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'transparent'}` }}>
                  <span style={{ fontSize: '1.5rem', width: 36, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                  <span style={{ fontWeight: 700, flex: 1, fontSize: '1.1rem' }}>{p.player_name}</span>
                  <span style={{ fontWeight: 800, fontSize: '1.3rem', color: i === 0 ? '#fbbf24' : '#e2e8f0' }}>{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {room.mode === 'attack' && room.current_question_index < CYBER_ATTACK_QUESTIONS.length - 1 && <button onClick={nextQuestion} style={greenBtn}>▶ Next Question</button>}
              {room.mode === 'quest' && <button onClick={nextQuestion} style={greenBtn}>🎭 Choose Next Scenario</button>}
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
            <a href="/game" style={{ ...greenBtn, display: 'inline-block', textDecoration: 'none' }}>🏠 New Game</a>
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
      <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.2rem' }}>{subtitle}</div>
      {active && <div style={{ marginTop: '0.5rem', color: color, fontSize: '0.8rem', fontWeight: 600 }}>✓ Selected</div>}
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>Scenario {scenario.id}</span>
            {scenario.aiEdition && <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontSize: '0.8rem', fontWeight: 700 }}>🤖 AI Edition</span>}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#e2e8f0' }}>{scenario.label}</h2>
          <p style={{ color: '#fb923c', fontWeight: 600, margin: '0.25rem 0 0' }}>{scenario.subtitle}</p>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.4rem' }}>IMPACT</div>
        <p style={{ color: '#fca5a5', margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>{scenario.impact}</p>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.4rem' }}>SCENARIO</div>
        <p style={{ color: '#e2e8f0', margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>{scenario.description}</p>
      </div>
      {/* MCQ preview for facilitator */}
      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ color: '#a5b4fc', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>MCQ QUESTION (players will see this)</div>
        <p style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '0.75rem' }}>{mcq.question}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {mcq.options.map((opt, i) => (
            <div key={i} style={{ background: mcq.correctIndices.includes(i) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${mcq.correctIndices.includes(i) ? '#22c55e50' : 'rgba(255,255,255,0.08)'}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <span style={{ color: mcq.correctIndices.includes(i) ? '#4ade80' : '#64748b', fontWeight: 700, flexShrink: 0 }}>{['A','B','C','D'][i]}{mcq.correctIndices.includes(i) ? ' ✓' : ''}</span>
              <span>{opt}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {status === 'lobby' && onStart && <button onClick={onStart} style={greenBtn}>▶ Start Round (3 min)</button>}
        {status === 'question' && onReveal && (
          <>
            <button onClick={onReveal} style={orangeBtn}>⏩ Reveal & Auto-Score</button>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{answerCount || 0}/{playerCount || 0} answered</span>
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
