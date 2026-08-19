'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { CYBER_ATTACK_QUESTIONS, CYBER_QUEST_SCENARIOS, SECTORS, type QuestScenario } from '@/lib/game-data';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

type GameMode = 'attack' | 'quest';
type GameStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

interface Player { id: string; player_name: string; score: number; avatar_color: string; is_host: boolean; last_seen_at: string | null; }
interface Room { room_code: string; sector: string; mode: GameMode; status: GameStatus; current_question_index: number; current_scenario_id: string | null; question_started_at: string | null; }
interface Answer { player_id: string; answer_index: number | null; is_correct: boolean | null; points_earned: number; }

export default function HostPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
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
    setTimerActive(false);
    await updateRoom({ status: 'reveal' });
    if (room?.mode === 'attack') {
      const q = CYBER_ATTACK_QUESTIONS[room.current_question_index];
      const key = `attack_${room.current_question_index}`;
      const { data: rawAnswers } = await supabase.from('game_answers').select('*').eq('room_code', roomCode).eq('question_key', key);
      if (rawAnswers) {
        for (const ans of rawAnswers) {
          const isCorrect = ans.answer_index === q.correctIndex;
          const timeSec = ans.response_time_ms / 1000;
          const timeBonus = Math.floor(500 * Math.max(0, 1 - timeSec / 60));
          const pts = isCorrect ? 1000 + timeBonus : 0;
          await supabase.from('game_answers').update({ is_correct: isCorrect, points_earned: pts }).eq('id', ans.id);
          if (pts > 0) {
            await supabase.from('game_players').update({ score: (players.find(p => p.id === ans.player_id)?.score || 0) + pts }).eq('id', ans.player_id);
          }
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
      setSelectedScenario(null);
    }
    setAnswers([]);
  }

  async function awardQuestPoints(playerId: string, pts: number) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const key = `quest_${room?.current_scenario_id}`;
    await supabase.from('game_answers').upsert({
      room_code: roomCode, player_id: playerId, question_key: key,
      points_earned: (answers.find(a => a.player_id === playerId)?.points_earned || 0) + pts,
    }, { onConflict: 'room_code,player_id,question_key' });
    await supabase.from('game_players').update({ score: player.score + pts }).eq('id', playerId);
    await loadPlayers();
    await loadAnswers(key);
  }

  async function startQuestScenario(scenarioId: string) {
    setSelectedScenario(scenarioId);
    await updateRoom({ current_scenario_id: scenarioId, status: 'lobby' });
  }

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) return <div style={{ color: '#fff', textAlign: 'center', padding: '3rem', fontSize: '1.5rem' }}>Loading room...</div>;

  const currentQ = room.mode === 'attack' ? CYBER_ATTACK_QUESTIONS[room.current_question_index] : null;
  const currentScenario = room.mode === 'quest' && room.current_scenario_id ? CYBER_QUEST_SCENARIOS.find(s => s.id === room.current_scenario_id) : null;
  const sector = SECTORS.find(s => s.id === room.sector);
  const nonHostPlayers = players.filter(p => !p.is_host);
  const now = Date.now();
  const activePlayers = nonHostPlayers.filter(p => {
    if (!p.last_seen_at) return false;
    return now - new Date(p.last_seen_at).getTime() < 60000;
  });
  const inactivePlayers = nonHostPlayers.filter(p => {
    if (!p.last_seen_at) return true;
    return now - new Date(p.last_seen_at).getTime() >= 60000;
  });
  const answerCount = answers.length;
  const answerDistribution = room.mode === 'attack' && currentQ
    ? [0, 1, 2, 3].map(i => ({ index: i, count: answers.filter(a => a.answer_index === i).length, isCorrect: i === currentQ.correctIndex }))
    : [];

  const optionColors = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];
  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>CYBER ESSENTIALS IN ACTION</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{sector?.icon} {sector?.label} · Facilitator View</div>
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
          {timerActive && timeLeft > 0 && (
            <div style={{ background: timeLeft <= 10 ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.2)', borderRadius: '0.75rem', padding: '0.5rem 1rem', textAlign: 'center', minWidth: 70 }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Time</div>
              <div style={{ fontWeight: 800, fontSize: '1.8rem', color: timeLeft <= 10 ? '#ef4444' : '#a5b4fc' }}>{timeLeft}s</div>
            </div>
          )}
        </div>
      </div>

      {/* Persistent End Game button — always visible bottom-right */}
      {room.status !== 'ended' && (
        <button
          onClick={() => { if (confirm('End the game for all players?')) updateRoom({ status: 'ended' }); }}
          style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 100, background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', color: '#f87171', borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', transition: 'all 0.15s' }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.35)'; (e.currentTarget as HTMLElement).style.borderColor = '#ef4444'; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)'; }}
        >
          🏁 End Game
        </button>
      )}

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        {room.status === 'lobby' && !room.current_scenario_id && (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Select Game Mode</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <ModeCard active={room.mode === 'attack'} icon="⚡" title="Cyber Attack" subtitle="Quick-fire MCQ · 1 min/question · Speed scoring" color="#f97316" onClick={() => startMode('attack')} />
                <ModeCard active={room.mode === 'quest'} icon="🎭" title="Cyber Quest" subtitle="Scenario role-play · 9 scenarios · 3 min each" color="#22c55e" onClick={() => startMode('quest')} />
              </div>
            </div>

            {room.mode === 'attack' && (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>⚡ Question {room.current_question_index + 1} of {CYBER_ATTACK_QUESTIONS.length}</h3>
                  <span style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', borderRadius: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{CYBER_ATTACK_QUESTIONS[room.current_question_index]?.pillar}</span>
                </div>
                <p style={{ fontSize: '1.3rem', color: '#e2e8f0', marginBottom: '1.5rem', lineHeight: 1.5 }}>{CYBER_ATTACK_QUESTIONS[room.current_question_index]?.question}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {CYBER_ATTACK_QUESTIONS[room.current_question_index]?.options.map((opt, i) => (
                    <div key={i} style={{ background: `${optionColors[i]}20`, border: `2px solid ${optionColors[i]}50`, borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ background: optionColors[i], borderRadius: '0.375rem', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{optionLabels[i]}</span>
                      <span style={{ fontSize: '0.95rem' }}>{opt}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={startQuestion} style={greenBtn}>▶ Start Question (1 min)</button>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{nonHostPlayers.length} players waiting</span>
                </div>
              </div>
            )}

            {room.mode === 'quest' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>🎭 Choose a Scenario to Run</h3>
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

        {room.status === 'lobby' && room.mode === 'quest' && currentScenario && (
          <QuestScenarioView scenario={currentScenario} status={room.status} onStart={startQuestion} playerCount={nonHostPlayers.length} />
        )}

        {room.mode === 'attack' && room.status === 'question' && currentQ && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>⚡ Q{room.current_question_index + 1} · {currentQ.category}</span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{answerCount}/{nonHostPlayers.length} answered</span>
                <button onClick={revealAnswer} style={orangeBtn}>⏩ Reveal Answer</button>
              </div>
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1.5rem', lineHeight: 1.4 }}>{currentQ.question}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {answerDistribution.map(d => (
                <div key={d.index} style={{ background: `${optionColors[d.index]}15`, border: `2px solid ${optionColors[d.index]}40`, borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: optionColors[d.index] }}>{optionLabels[d.index]}</span>
                    <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{d.count}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6 }}>
                    <div style={{ height: '100%', background: optionColors[d.index], borderRadius: 3, width: nonHostPlayers.length > 0 ? `${(d.count / nonHostPlayers.length) * 100}%` : '0%', transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {room.mode === 'quest' && room.status === 'question' && currentScenario && (
          <QuestScenarioView scenario={currentScenario} status="question" onReveal={revealAnswer} playerCount={nonHostPlayers.length} answerCount={answerCount} />
        )}

        {room.status === 'reveal' && (
          <div>
            {room.mode === 'attack' && currentQ && (
              <div style={card}>
                <h3 style={{ color: '#22c55e', fontSize: '1.2rem', marginBottom: '1rem' }}>✅ Answer Revealed</h3>
                <p style={{ fontSize: '1.3rem', color: '#e2e8f0', marginBottom: '1rem' }}>{currentQ.question}</p>
                <div style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>CORRECT ANSWER</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{optionLabels[currentQ.correctIndex]}. {currentQ.options[currentQ.correctIndex]}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>💡 {currentQ.explanation}</div>
                {currentQ.funFact && <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', marginBottom: '1rem', color: '#a5b4fc', fontSize: '0.9rem' }}>🤓 Fun fact: {currentQ.funFact}</div>}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {answerDistribution.map(d => (
                      <div key={d.index} style={{ background: d.isCorrect ? 'rgba(34,197,94,0.15)' : `${optionColors[d.index]}15`, border: `2px solid ${d.isCorrect ? '#22c55e' : optionColors[d.index] + '40'}`, borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: d.isCorrect ? '#22c55e' : optionColors[d.index] }}>{optionLabels[d.index]} {d.isCorrect ? '✓' : ''}</span>
                          <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{d.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={showLeaderboard} style={greenBtn}>📊 Show Leaderboard</button>
                  <button onClick={nextQuestion} style={grayBtn}>⏭ Next Question</button>
                </div>
              </div>
            )}
            {room.mode === 'quest' && currentScenario && (
              <div style={card}>
                <h3 style={{ color: '#22c55e', fontSize: '1.2rem', marginBottom: '1rem' }}>🎭 Debrief: {currentScenario.label}</h3>
                <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Award points to players who gave the best answers.</p>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Award Points</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {nonHostPlayers.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                          <span style={{ fontWeight: 600 }}>{p.player_name}</span>
                          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{answers.find(a => a.player_id === p.id) ? '✅ Responded' : '⏳ Waiting'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {[100, 300, 500].map(pts => (
                            <button key={pts} onClick={() => awardQuestPoints(p.id, pts)} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e40', color: '#4ade80', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>+{pts}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.5rem' }}>🛡️ Key Protection Measures</div>
                  {currentScenario.protectionTips.map((tip, i) => <div key={i} style={{ color: '#d1fae5', fontSize: '0.9rem', marginBottom: '0.3rem' }}>• {tip}</div>)}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={showLeaderboard} style={greenBtn}>📊 Show Leaderboard</button>
                  <button onClick={nextQuestion} style={grayBtn}>🎭 Choose Another Scenario</button>
                </div>
              </div>
            )}
          </div>
        )}

        {room.mode === 'quest' && room.status === 'lobby' && currentScenario && !room.question_started_at && (
          <QuestScenarioView scenario={currentScenario} status="lobby" onStart={startQuestion} playerCount={nonHostPlayers.length} />
        )}

        {room.status === 'leaderboard' && (
          <div style={card}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '0.5rem' }}>🏆 Leaderboard</h2>
            {room.mode === 'attack' && <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '2rem' }}>After Q{room.current_question_index + 1} of {CYBER_ATTACK_QUESTIONS.length}</p>}
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

        {room.status === 'ended' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Game Over!</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Final Standings</p>
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
            <a href="/game" style={{ ...greenBtn, display: 'inline-block', textDecoration: 'none' }}>🏠 Back to Home</a>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeCard({ active, icon, title, subtitle, color, onClick }: { active: boolean; icon: string; title: string; subtitle: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flex: '1 1 250px', background: active ? `${color}20` : 'rgba(255,255,255,0.05)', border: `3px solid ${active ? color : 'rgba(255,255,255,0.1)'}`, borderRadius: '1rem', padding: '1.5rem', cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'all 0.15s' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '1.3rem', color: active ? color : '#e2e8f0' }}>{title}</div>
      <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>{subtitle}</div>
      {active && <div style={{ marginTop: '0.75rem', color: color, fontSize: '0.85rem', fontWeight: 600 }}>✓ Selected</div>}
    </button>
  );
}

function QuestScenarioView({ scenario, status, onStart, onReveal, playerCount, answerCount }: { scenario: QuestScenario; status: GameStatus; onStart?: () => void; onReveal?: () => void; playerCount?: number; answerCount?: number }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '3rem' }}>{scenario.icon}</span>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>Scenario {scenario.id}</span>
            {scenario.aiEdition && <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontSize: '0.8rem', fontWeight: 700 }}>🤖 AI Edition</span>}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#e2e8f0' }}>{scenario.label}</h2>
          <p style={{ color: '#fb923c', fontWeight: 600, margin: '0.25rem 0 0' }}>{scenario.subtitle}</p>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>IMPACT</div>
        <p style={{ color: '#fca5a5', margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>{scenario.impact}</p>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Scenario</div>
        <p style={{ color: '#e2e8f0', margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>{scenario.description}</p>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Role Assignments</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {scenario.roles.map(r => (
            <div key={r.role} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '0.875rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.95rem' }}>{r.icon} {r.role}</div>
              {r.tasks.map((task, i) => <div key={i} style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '0.25rem' }}>• {task}</div>)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {status === 'lobby' && onStart && <button onClick={onStart} style={greenBtn}>▶ Start Round (3 min)</button>}
        {status === 'question' && onReveal && (
          <>
            <button onClick={onReveal} style={orangeBtn}>⏩ End Round & Debrief</button>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{answerCount || 0}/{playerCount || 0} responded</span>
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
