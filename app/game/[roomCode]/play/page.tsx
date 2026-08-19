'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  CYBER_ATTACK_QUESTIONS, CYBER_QUEST_SCENARIOS,
  getShuffledAttackQuestion, getQuestMCQ,
  type Difficulty,
} from '@/lib/game-data';
import { getSpeedTier } from '@/lib/game-utils';
import { ScenarioAnimation } from '@/components/ScenarioAnimation';
import { QuestionExample } from '@/components/QuestionExample';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

type GameMode = 'attack' | 'quest';
type GameStatus = 'lobby' | 'question' | 'reveal' | 'reveal_example' | 'leaderboard' | 'ended';

interface Room {
  room_code: string; sector: string; mode: GameMode; status: GameStatus;
  current_question_index: number; current_scenario_id: string | null;
  question_started_at: string | null; difficulty: Difficulty;
}
interface Player { id: string; player_name: string; score: number; avatar_color: string; is_host: boolean; }

const OPTION_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_SHAPES = ['▲', '●', '■', '★'];

// ─── Animated circular countdown clock ───────────────────────────────────────
function CircularTimer({ timeLeft, totalTime, size = 120 }: { timeLeft: number; totalTime: number; size?: number }) {
  const pct = Math.max(0, timeLeft / totalTime);
  const r = size * 0.4;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f97316' : '#ef4444';
  const cx = size / 2;
  const pulse = timeLeft <= 10 && timeLeft > 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ animation: pulse ? 'pulse 0.8s ease-in-out infinite alternate' : 'none' }}>
        <style>{`@keyframes pulse { from { transform: scale(1); } to { transform: scale(1.08); } }`}</style>
        <circle cx={cx} cy={cx} r={r} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s ease' }}
        />
        {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
          const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
          const ro = r * 0.85; const ri = r * (i % 3 === 0 ? 0.72 : 0.78);
          return <line key={i} x1={cx + ro * Math.cos(a)} y1={cx + ro * Math.sin(a)} x2={cx + ri * Math.cos(a)} y2={cx + ri * Math.sin(a)} stroke="rgba(255,255,255,0.2)" strokeWidth={i % 3 === 0 ? 2 : 1} />;
        })}
        <text x={cx} y={cx - 5} textAnchor="middle" fill="white" fontSize={size * 0.2} fontWeight="900">{timeLeft}</text>
        <text x={cx} y={cx + size * 0.13} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={size * 0.09} fontWeight="600">SEC</text>
      </svg>
    </div>
  );
}


export default function PlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId') || '';

  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedAttackAnswer, setSelectedAttackAnswer] = useState<number | null>(null);
  const [selectedQuestAnswers, setSelectedQuestAnswers] = useState<number[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submitTime, setSubmitTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [myResult, setMyResult] = useState<{ correct: boolean; points: number; half?: boolean; responseMs?: number } | null>(null);
  const questionStartRef = useRef<number | null>(null);
  const roomRef = useRef<Room | null>(null);

  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single();
    if (data) { setRoom(data); roomRef.current = data; }
  }, [roomCode]);

  const loadPlayer = useCallback(async () => {
    if (!playerId) return;
    const { data } = await supabase.from('game_players').select('*').eq('id', playerId).single();
    if (data) setPlayer(data);
  }, [playerId]);

  const loadAllPlayers = useCallback(async () => {
    const { data } = await supabase.from('game_players').select('*').eq('room_code', roomCode).order('score', { ascending: false });
    if (data) setAllPlayers(data);
  }, [roomCode]);

  const fetchMyResult = useCallback(async (currentRoom: Room) => {
    const key = currentRoom.mode === 'attack'
      ? `attack_${currentRoom.current_question_index}`
      : `quest_${currentRoom.current_scenario_id}`;
    let attempts = 0;
    const check = async () => {
      const { data } = await supabase.from('game_answers').select('*')
        .eq('room_code', roomCode).eq('player_id', playerId).eq('question_key', key)
        .order('submitted_at', { ascending: false }).limit(1).maybeSingle();
      if (data && data.is_correct !== null) {
        setMyResult({ correct: data.is_correct, points: data.points_earned, half: !data.is_correct && data.points_earned > 0, responseMs: data.response_time_ms });
      } else if (attempts++ < 6) {
        setTimeout(check, 1000);
      }
    };
    check();
  }, [roomCode, playerId]);

  useEffect(() => {
    loadRoom();
    loadPlayer();
    loadAllPlayers();

    const channel = supabase.channel(`play-${roomCode}-${playerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `room_code=eq.${roomCode}` }, (payload) => {
        const newRoom = payload.new as Room;
        setRoom(newRoom);
        roomRef.current = newRoom;
        if (newRoom.status === 'question') {
          setSelectedAttackAnswer(null);
          setSelectedQuestAnswers([]);
          setHasSubmitted(false);
          setSubmitTime(null);
          setMyResult(null);
          const limit = newRoom.mode === 'attack' ? 60 : 180;
          setTotalTime(limit);
          setTimeLeft(limit);
          setTimerRunning(true);
          questionStartRef.current = Date.now();
        }
        if (newRoom.status === 'reveal' || newRoom.status === 'reveal_example') {
          setTimerRunning(false);
          fetchMyResult(newRoom);
        }
        if (newRoom.status === 'leaderboard' || newRoom.status === 'lobby') {
          setTimerRunning(false);
          loadAllPlayers();
          loadPlayer();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `id=eq.${playerId}` }, () => loadPlayer())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_answers', filter: `room_code=eq.${roomCode}` }, async () => {
        const cr = roomRef.current;
        if (cr?.status === 'reveal' || cr?.status === 'reveal_example') fetchMyResult(cr);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadRoom, loadPlayer, loadAllPlayers, fetchMyResult, roomCode, playerId]);

  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timeLeft]);

  // Heartbeat
  useEffect(() => {
    if (!playerId) return;
    const ping = () => supabase.from('game_players').update({ last_seen_at: new Date().toISOString() }).eq('id', playerId);
    ping();
    const id = setInterval(ping, 30000);
    return () => clearInterval(id);
  }, [playerId]);

  async function submitAttackAnswer(index: number) {
    if (hasSubmitted || !room) return;
    const elapsed = questionStartRef.current ? Date.now() - questionStartRef.current : 60000;
    setSelectedAttackAnswer(index);
    setHasSubmitted(true);
    setSubmitTime(elapsed);
    setTimerRunning(false);
    const key = `attack_${room.current_question_index}`;
    await supabase.from('game_answers').upsert({
      room_code: roomCode, player_id: playerId, question_key: key,
      answer_index: index, response_time_ms: elapsed,
    }, { onConflict: 'room_code,player_id,question_key' });
  }

  function toggleQuestAnswer(index: number) {
    if (hasSubmitted) return;
    setSelectedQuestAnswers(prev => prev.includes(index) ? prev.filter(i => i !== index) : prev.length >= 2 ? prev : [...prev, index]);
  }

  async function submitQuestAnswer() {
    if (hasSubmitted || !room || selectedQuestAnswers.length === 0) return;
    const elapsed = questionStartRef.current ? Date.now() - questionStartRef.current : 180000;
    setHasSubmitted(true);
    setSubmitTime(elapsed);
    const key = `quest_${room.current_scenario_id}`;
    await supabase.from('game_answers').upsert({
      room_code: roomCode, player_id: playerId, question_key: key,
      answer_text: JSON.stringify(selectedQuestAnswers), response_time_ms: elapsed,
    }, { onConflict: 'room_code,player_id,question_key' });
  }

  if (!room || !player) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem' }}>Connecting to game...</p>
      </div>
    );
  }

  const seed = roomCode + (room.mode === 'attack' ? room.current_question_index : room.current_scenario_id);
  const difficulty: Difficulty = room.difficulty || 'medium';
  const shuffledQ = room.mode === 'attack' ? getShuffledAttackQuestion(room.current_question_index, difficulty, seed) : null;
  const questMCQ = room.mode === 'quest' && room.current_scenario_id ? getQuestMCQ(room.current_scenario_id, difficulty, seed) : null;
  const currentScenario = room.mode === 'quest' && room.current_scenario_id ? CYBER_QUEST_SCENARIOS.find(s => s.id === room.current_scenario_id) : null;
  const nonHostPlayers = allPlayers.filter(p => !p.is_host);
  const myRank = [...nonHostPlayers].sort((a, b) => b.score - a.score).findIndex(p => p.id === playerId) + 1;
  const speedTier = submitTime !== null ? getSpeedTier(submitTime) : null;

  const diffBadge: Record<Difficulty, string> = { easy: '#22c55e', medium: '#f97316', hard: '#ef4444' };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0.65rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/csa-logo.svg" alt="CSA" style={{ height: 26, opacity: 0.85 }} />
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: player.avatar_color, display: 'inline-block' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{player.player_name}</span>
          <span style={{ background: `${diffBadge[difficulty]}20`, color: diffBadge[difficulty], borderRadius: '0.375rem', padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 700 }}>{difficulty.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          {timerRunning && <CircularTimer timeLeft={timeLeft} totalTime={totalTime} size={72} />}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fbbf24' }}>{player.score.toLocaleString()}</div>
            <div style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase' }}>pts</div>
          </div>
          {myRank > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>#{myRank}</div>
              <div style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase' }}>rank</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '1.25rem', maxWidth: 700, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* LOBBY */}
        {room.status === 'lobby' && !currentScenario && (
          <div style={{ textAlign: 'center', paddingTop: '2.5rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>⏳</div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>
              {room.mode === 'attack' ? `⚡ Cyber Attack` : '🎭 Cyber Quest'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Waiting for the facilitator to start...</p>
            <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '1.25rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
                {nonHostPlayers.map(p => (
                  <div key={p.id} style={{ background: `${p.avatar_color}20`, border: `1px solid ${p.avatar_color}50`, borderRadius: '2rem', padding: '0.3rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                    <span style={{ fontWeight: p.id === playerId ? 800 : 500, fontSize: '0.9rem' }}>{p.player_name}{p.id === playerId ? ' (You)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LOBBY with quest scenario briefing + animation */}
        {room.status === 'lobby' && currentScenario && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.4rem' }}>{currentScenario.icon}</div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{currentScenario.label}</h2>
              <p style={{ color: '#fb923c', fontWeight: 600, fontSize: '0.9rem' }}>{currentScenario.subtitle}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <p style={{ color: '#e2e8f0', margin: 0, lineHeight: 1.7, fontSize: '0.9rem' }}>{currentScenario.description}</p>
            </div>
            <ScenarioAnimation scenarioId={currentScenario.id} />
            <p style={{ color: '#64748b', textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>⏳ Waiting for facilitator to start...</p>
          </div>
        )}

        {/* ATTACK QUESTION */}
        {room.status === 'question' && room.mode === 'attack' && shuffledQ && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
              <span style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', borderRadius: '0.5rem', padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 600 }}>{shuffledQ.pillar}</span>
              <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Q{room.current_question_index + 1} of {CYBER_ATTACK_QUESTIONS.length}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{shuffledQ.question}</p>
            </div>
            {!hasSubmitted ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                {shuffledQ.options.map((opt, i) => (
                  <button key={i} onClick={() => submitAttackAnswer(i)}
                    style={{ background: `${OPTION_COLORS[i]}20`, border: `3px solid ${OPTION_COLORS[i]}60`, borderRadius: '1rem', padding: '1.1rem', cursor: 'pointer', color: '#fff', textAlign: 'left', transition: 'all 0.1s', fontSize: '0.95rem', lineHeight: 1.4 }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = `${OPTION_COLORS[i]}35`; (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = `${OPTION_COLORS[i]}20`; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                      <span style={{ background: OPTION_COLORS[i], borderRadius: '0.5rem', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>{OPTION_SHAPES[i]}</span>
                      <span>{opt}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{selectedAttackAnswer !== null ? OPTION_SHAPES[selectedAttackAnswer] : '✓'}</div>
                {selectedAttackAnswer !== null && (
                  <div style={{ background: `${OPTION_COLORS[selectedAttackAnswer]}20`, border: `2px solid ${OPTION_COLORS[selectedAttackAnswer]}`, borderRadius: '1rem', padding: '0.875rem', marginBottom: '0.875rem', display: 'inline-block' }}>
                    <span style={{ fontWeight: 700, color: OPTION_COLORS[selectedAttackAnswer] }}>{OPTION_LABELS[selectedAttackAnswer]}.</span> {shuffledQ.options[selectedAttackAnswer]}
                  </div>
                )}
                {speedTier && (
                  <div style={{ marginTop: '0.5rem', background: `${speedTier.color}18`, border: `1px solid ${speedTier.color}40`, borderRadius: '0.75rem', padding: '0.625rem 1.25rem', display: 'inline-block' }}>
                    <span style={{ fontSize: '1.3rem' }}>{speedTier.emoji}</span>
                    <span style={{ fontWeight: 700, color: speedTier.color, marginLeft: '0.5rem' }}>{speedTier.label}</span>
                    <span style={{ color: '#64748b', fontSize: '0.82rem', marginLeft: '0.5rem' }}>({(submitTime! / 1000).toFixed(1)}s)</span>
                  </div>
                )}
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '0.75rem' }}>Waiting for results...</p>
              </div>
            )}
          </div>
        )}

        {/* QUEST MCQ */}
        {room.status === 'question' && room.mode === 'quest' && currentScenario && questMCQ && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.65rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.6rem' }}>{currentScenario.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentScenario.label}</div>
                  <div style={{ color: '#fb923c', fontSize: '0.8rem' }}>{currentScenario.subtitle}</div>
                </div>
              </div>
              <p style={{ color: '#cbd5e1', lineHeight: 1.7, margin: 0, fontSize: '0.875rem' }}>{currentScenario.description}</p>
            </div>

            {!hasSubmitted ? (
              <>
                <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.875rem', fontWeight: 600, fontSize: '0.95rem' }}>
                  {questMCQ.question}
                  <span style={{ color: '#64748b', fontWeight: 400, fontSize: '0.82rem', marginLeft: '0.4rem' }}>({selectedQuestAnswers.length}/2)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1rem' }}>
                  {questMCQ.options.map((opt, i) => {
                    const sel = selectedQuestAnswers.includes(i);
                    return (
                      <button key={i} onClick={() => toggleQuestAnswer(i)}
                        style={{ background: sel ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)', border: `2px solid ${sel ? '#6366f1' : 'rgba(255,255,255,0.12)'}`, borderRadius: '0.875rem', padding: '0.875rem 1rem', cursor: 'pointer', color: '#fff', textAlign: 'left', display: 'flex', gap: '0.875rem', alignItems: 'center', transition: 'all 0.1s' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '0.375rem', background: sel ? '#6366f1' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem', flexShrink: 0 }}>{sel ? '✓' : OPTION_LABELS[i]}</span>
                        <span style={{ lineHeight: 1.5, fontSize: '0.9rem' }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={submitQuestAnswer} disabled={selectedQuestAnswers.length === 0}
                  style={{ width: '100%', background: selectedQuestAnswers.length > 0 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '0.875rem', color: '#fff', fontSize: '1rem', fontWeight: 700, padding: '0.875rem', cursor: selectedQuestAnswers.length > 0 ? 'pointer' : 'default', boxShadow: selectedQuestAnswers.length > 0 ? '0 4px 12px rgba(99,102,241,0.35)' : 'none', transition: 'all 0.2s' }}>
                  ✅ Submit ({selectedQuestAnswers.length}/2 selected)
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
                <h3 style={{ color: '#6366f1', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Answers Submitted!</h3>
                {speedTier && (
                  <div style={{ marginBottom: '0.75rem', background: `${speedTier.color}18`, border: `1px solid ${speedTier.color}40`, borderRadius: '0.75rem', padding: '0.5rem 1rem', display: 'inline-block' }}>
                    <span>{speedTier.emoji}</span>
                    <span style={{ fontWeight: 700, color: speedTier.color, marginLeft: '0.4rem' }}>{speedTier.label}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem', textAlign: 'left' }}>
                  {selectedQuestAnswers.map(i => (
                    <div key={i} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '0.625rem', padding: '0.6rem 0.875rem', fontSize: '0.875rem' }}>
                      {OPTION_LABELS[i]}. {questMCQ.options[i]}
                    </div>
                  ))}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Waiting for reveal...</p>
              </div>
            )}
          </div>
        )}

        {/* REVEAL & REVEAL_EXAMPLE - Attack */}
        {(room.status === 'reveal' || room.status === 'reveal_example') && room.mode === 'attack' && shuffledQ && (
          <div>
            {myResult ? (
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', padding: '1.25rem', background: myResult.correct ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: '1.25rem', border: `2px solid ${myResult.correct ? '#22c55e' : '#ef4444'}` }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.4rem' }}>{myResult.correct ? '🎉' : '😔'}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: myResult.correct ? '#4ade80' : '#f87171' }}>{myResult.correct ? 'Correct!' : 'Incorrect'}</div>
                {myResult.points > 0 && <div style={{ fontSize: '1.2rem', color: '#fbbf24', fontWeight: 800, marginTop: '0.2rem' }}>+{myResult.points} pts</div>}
                {myResult.responseMs !== undefined && (() => {
                  const tier = getSpeedTier(myResult.responseMs);
                  return (
                    <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: `${tier.color}20`, border: `1px solid ${tier.color}40`, borderRadius: '0.625rem', padding: '0.3rem 0.75rem' }}>
                      <span>{tier.emoji}</span>
                      <span style={{ color: tier.color, fontWeight: 700, fontSize: '0.9rem' }}>{tier.label}</span>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({(myResult.responseMs / 1000).toFixed(1)}s)</span>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '1rem' }}>
                <p style={{ color: '#94a3b8', margin: 0 }}>You didn&apos;t submit an answer.</p>
              </div>
            )}
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '0.875rem' }}>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.4rem' }}>CORRECT ANSWER</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{OPTION_LABELS[shuffledQ.correctIndex]}. {shuffledQ.options[shuffledQ.correctIndex]}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1rem 1.25rem', color: '#cbd5e1', lineHeight: 1.7, fontSize: '0.9rem', marginBottom: '0.5rem' }}>💡 {shuffledQ.explanation}</div>
            {shuffledQ.funFact && <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '1rem', padding: '0.875rem 1.25rem', color: '#a5b4fc', fontSize: '0.85rem', marginBottom: '0.5rem' }}>🤓 {shuffledQ.funFact}</div>}
            {/* Real-world example — shown when facilitator reveals it */}
            {room.status === 'reveal_example' && (
              <QuestionExample questionId={CYBER_ATTACK_QUESTIONS[room.current_question_index]?.id} />
            )}
          </div>
        )}

        {/* REVEAL & REVEAL_EXAMPLE - Quest */}
        {(room.status === 'reveal' || room.status === 'reveal_example') && room.mode === 'quest' && currentScenario && questMCQ && (
          <div>
            {myResult !== null ? (
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', padding: '1.25rem', background: myResult.correct ? 'rgba(34,197,94,0.15)' : myResult.half ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: '1.25rem', border: `2px solid ${myResult.correct ? '#22c55e' : myResult.half ? '#f97316' : '#ef4444'}` }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.4rem' }}>{myResult.correct ? '🎉' : myResult.half ? '🙂' : '😔'}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: myResult.correct ? '#4ade80' : myResult.half ? '#fb923c' : '#f87171' }}>
                  {myResult.correct ? 'Both correct! 🎯' : myResult.half ? 'One correct!' : 'Neither matched'}
                </div>
                {myResult.points > 0 && <div style={{ fontSize: '1.2rem', color: '#fbbf24', fontWeight: 800, marginTop: '0.2rem' }}>+{myResult.points} pts</div>}
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '1rem' }}>
                <p style={{ color: '#94a3b8', margin: 0 }}>No answer submitted.</p>
              </div>
            )}
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '0.875rem' }}>
              <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>✅ Correct Answers</div>
              {questMCQ.correctIndices.map(ci => <div key={ci} style={{ color: '#d1fae5', marginBottom: '0.3rem', fontSize: '0.9rem' }}>• {questMCQ.options[ci]}</div>)}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '0.875rem' }}>
              <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.82rem', textTransform: 'uppercase' }}>All Protection Tips</div>
              {currentScenario.protectionTips.map((tip, i) => <div key={i} style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '0.35rem' }}>• {tip}</div>)}
            </div>
            {/* Scenario simulation — shown when facilitator reveals it */}
            {room.status === 'reveal_example' && (
              <ScenarioAnimation scenarioId={currentScenario.id} label={currentScenario.label} />
            )}
          </div>
        )}

        {/* LEADERBOARD */}
        {room.status === 'leaderboard' && (
          <div>
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '1.25rem' }}>🏆 Leaderboard</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {[...nonHostPlayers].sort((a, b) => b.score - a.score).slice(0, 10).map((p, i) => {
                const isMe = p.id === playerId;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', background: isMe ? 'rgba(99,102,241,0.2)' : i === 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)', borderRadius: '0.875rem', padding: '0.8rem 1.1rem', border: isMe ? '2px solid #6366f1' : `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'transparent'}` }}>
                    <span style={{ width: 34, textAlign: 'center', fontSize: '1.2rem' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: p.avatar_color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontWeight: isMe ? 800 : 600, flex: 1 }}>{p.player_name}{isMe ? ' (You)' : ''}</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: i === 0 ? '#fbbf24' : '#e2e8f0' }}>{p.score.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ENDED */}
        {room.status === 'ended' && (
          <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Game Over!</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Final score: <strong style={{ color: '#fbbf24' }}>{player.score.toLocaleString()} pts</strong> · Rank #{myRank}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/game" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', textDecoration: 'none', borderRadius: '0.75rem', padding: '0.875rem 2rem', fontWeight: 700, fontSize: '1.1rem', display: 'inline-block' }}>🏠 Play Again</a>
              <a href="/game/resources" target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(200,16,46,0.2)', border: '2px solid #C8102E', color: '#fca5a5', textDecoration: 'none', borderRadius: '0.75rem', padding: '0.875rem 2rem', fontWeight: 700, fontSize: '1.1rem', display: 'inline-block' }}>🛡️ CSA Resources &amp; QR Codes</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
