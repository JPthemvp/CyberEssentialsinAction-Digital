'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { CYBER_ATTACK_QUESTIONS, CYBER_QUEST_SCENARIOS } from '@/lib/game-data';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

type GameMode = 'attack' | 'quest';
type GameStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

interface Room { room_code: string; sector: string; mode: GameMode; status: GameStatus; current_question_index: number; current_scenario_id: string | null; question_started_at: string | null; }
interface Player { id: string; player_name: string; score: number; avatar_color: string; is_host: boolean; }

const OPTION_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_SHAPES = ['▲', '●', '■', '★'];

export default function PlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId') || '';

  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [questResponse, setQuestResponse] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [myResult, setMyResult] = useState<{ correct: boolean; points: number } | null>(null);
  const questionStartRef = useRef<number | null>(null);

  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single();
    if (data) setRoom(data);
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

  useEffect(() => {
    loadRoom();
    loadPlayer();
    loadAllPlayers();

    const channel = supabase.channel(`play-${roomCode}-${playerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `room_code=eq.${roomCode}` }, (payload) => {
        const newRoom = payload.new as Room;
        setRoom(newRoom);
        if (newRoom.status === 'question') {
          setSelectedAnswer(null);
          setQuestResponse('');
          setHasSubmitted(false);
          setMyResult(null);
          const timeLimitSec = newRoom.mode === 'attack' ? 60 : 180;
          setTimeLeft(timeLimitSec);
          setTimerRunning(true);
          questionStartRef.current = Date.now();
        }
        if (newRoom.status === 'reveal') {
          setTimerRunning(false);
        }
        if (newRoom.status === 'leaderboard' || newRoom.status === 'lobby') {
          setTimerRunning(false);
          loadAllPlayers();
          loadPlayer();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `id=eq.${playerId}` }, () => loadPlayer())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_answers', filter: `room_code=eq.${roomCode}` }, async () => {
        if (room?.status === 'reveal' && room.mode === 'attack') {
          const key = `attack_${room.current_question_index}`;
          const { data } = await supabase.from('game_answers').select('*').eq('room_code', roomCode).eq('player_id', playerId).eq('question_key', key).single();
          if (data) setMyResult({ correct: data.is_correct ?? false, points: data.points_earned });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadRoom, loadPlayer, loadAllPlayers, room, roomCode, playerId]);

  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timeLeft]);

  // Heartbeat: update last_seen_at every 30s so host can track active players
  useEffect(() => {
    if (!playerId) return;
    const ping = () => supabase.from('game_players').update({ last_seen_at: new Date().toISOString() }).eq('id', playerId);
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [playerId]);

  useEffect(() => {
    if (room?.status === 'reveal' && room.mode === 'attack') {
      const key = `attack_${room.current_question_index}`;
      supabase.from('game_answers').select('*').eq('room_code', roomCode).eq('player_id', playerId).eq('question_key', key).single()
        .then(({ data }) => { if (data) setMyResult({ correct: data.is_correct ?? false, points: data.points_earned }); });
    }
  }, [room?.status, room?.current_question_index, room?.mode, roomCode, playerId]);

  async function submitAttackAnswer(index: number) {
    if (hasSubmitted || !room) return;
    setSelectedAnswer(index);
    setHasSubmitted(true);
    const elapsed = questionStartRef.current ? Date.now() - questionStartRef.current : 30000;
    const key = `attack_${room.current_question_index}`;
    await supabase.from('game_answers').upsert({
      room_code: roomCode, player_id: playerId, question_key: key,
      answer_index: index, response_time_ms: elapsed,
    }, { onConflict: 'room_code,player_id,question_key' });
  }

  async function submitQuestResponse() {
    if (hasSubmitted || !room || !questResponse.trim()) return;
    setHasSubmitted(true);
    const key = `quest_${room.current_scenario_id}`;
    await supabase.from('game_answers').upsert({
      room_code: roomCode, player_id: playerId, question_key: key,
      answer_text: questResponse.trim(),
    }, { onConflict: 'room_code,player_id,question_key' });
  }

  if (!room || !player) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem' }}>Connecting to game...</p>
      </div>
    );
  }

  const currentQ = room.mode === 'attack' ? CYBER_ATTACK_QUESTIONS[room.current_question_index] : null;
  const currentScenario = room.mode === 'quest' && room.current_scenario_id ? CYBER_QUEST_SCENARIOS.find(s => s.id === room.current_scenario_id) : null;
  const myRank = [...allPlayers].sort((a, b) => b.score - a.score).findIndex(p => p.id === playerId) + 1;
  const nonHostPlayers = allPlayers.filter(p => !p.is_host);

  const timerPct = room.mode === 'attack' ? timeLeft / 60 : timeLeft / 180;
  const timerColor = timerPct > 0.5 ? '#22c55e' : timerPct > 0.25 ? '#f97316' : '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: player.avatar_color, display: 'inline-block' }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{player.player_name}</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {timerRunning && timeLeft > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.8rem', color: timerColor, lineHeight: 1 }}>{timeLeft}</div>
              <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>sec</div>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#fbbf24' }}>{player.score.toLocaleString()}</div>
            <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>pts</div>
          </div>
          {myRank > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>#{myRank}</div>
              <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>rank</div>
            </div>
          )}
        </div>
      </div>

      {/* Timer bar */}
      {timerRunning && (
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ height: '100%', background: timerColor, width: `${timerPct * 100}%`, transition: 'width 1s linear, background 1s' }} />
        </div>
      )}

      <div style={{ flex: 1, padding: '1.5rem', maxWidth: 700, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* LOBBY */}
        {room.status === 'lobby' && !currentScenario && (
          <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
              {room.mode === 'attack' ? `⚡ Round ${room.current_question_index + 1} of ${CYBER_ATTACK_QUESTIONS.length}` : '🎭 Cyber Quest'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Waiting for the facilitator to start the next question...</p>
            <div style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.04)', borderRadius: '1.25rem', padding: '1.5rem' }}>
              <div style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 600 }}>Players Joined</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {nonHostPlayers.map(p => (
                  <div key={p.id} style={{ background: `${p.avatar_color}20`, border: `1px solid ${p.avatar_color}50`, borderRadius: '2rem', padding: '0.35rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                    <span style={{ fontWeight: p.id === playerId ? 800 : 500, fontSize: '0.95rem' }}>{p.player_name}{p.id === playerId ? ' (You)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LOBBY with scenario selected */}
        {room.status === 'lobby' && currentScenario && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>{currentScenario.icon}</div>
              <h2 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>{currentScenario.label}</h2>
              <p style={{ color: '#fb923c', fontWeight: 600 }}>{currentScenario.subtitle}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.5rem' }}>SCENARIO</div>
              <p style={{ color: '#e2e8f0', margin: 0, lineHeight: 1.7 }}>{currentScenario.description}</p>
            </div>
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>⏳ Waiting for facilitator to start the round...</p>
          </div>
        )}

        {/* ATTACK QUESTION */}
        {room.status === 'question' && room.mode === 'attack' && currentQ && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', borderRadius: '0.5rem', padding: '0.2rem 0.7rem', fontSize: '0.8rem', fontWeight: 600 }}>{currentQ.pillar}</span>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Q{room.current_question_index + 1}/{CYBER_ATTACK_QUESTIONS.length}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '1.35rem', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{currentQ.question}</p>
            </div>
            {!hasSubmitted ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {currentQ.options.map((opt, i) => (
                  <button key={i} onClick={() => submitAttackAnswer(i)}
                    style={{ background: `${OPTION_COLORS[i]}20`, border: `3px solid ${OPTION_COLORS[i]}60`, borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', color: '#fff', textAlign: 'left', transition: 'all 0.1s', fontSize: '1rem', lineHeight: 1.4 }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = `${OPTION_COLORS[i]}35`; (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = `${OPTION_COLORS[i]}20`; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <span style={{ background: OPTION_COLORS[i], borderRadius: '0.5rem', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>{OPTION_SHAPES[i]}</span>
                      <span>{opt}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {selectedAnswer !== null ? OPTION_SHAPES[selectedAnswer] : '✓'}
                </div>
                {selectedAnswer !== null && (
                  <div style={{ background: `${OPTION_COLORS[selectedAnswer]}20`, border: `2px solid ${OPTION_COLORS[selectedAnswer]}`, borderRadius: '1rem', padding: '1rem', marginBottom: '1rem', display: 'inline-block' }}>
                    <span style={{ fontWeight: 700, color: OPTION_COLORS[selectedAnswer] }}>{OPTION_LABELS[selectedAnswer]}.</span> {currentQ.options[selectedAnswer]}
                  </div>
                )}
                <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Answer submitted! Waiting for results...</p>
              </div>
            )}
          </div>
        )}

        {/* QUEST QUESTION */}
        {room.status === 'question' && room.mode === 'quest' && currentScenario && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '2rem' }}>{currentScenario.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentScenario.label}</div>
                  <div style={{ color: '#fb923c', fontSize: '0.9rem' }}>{currentScenario.subtitle}</div>
                </div>
              </div>
              <p style={{ color: '#cbd5e1', lineHeight: 1.7, margin: 0, fontSize: '0.95rem' }}>{currentScenario.description}</p>
            </div>

            {!hasSubmitted ? (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.75rem', fontSize: '1.1rem' }}>
                    💬 What would you do in this scenario?
                  </label>
                  <textarea
                    value={questResponse}
                    onChange={e => setQuestResponse(e.target.value)}
                    rows={5}
                    placeholder="Describe your response, actions, or decision..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', color: '#fff', fontSize: '1rem', padding: '0.875rem', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  />
                </div>
                <button onClick={submitQuestResponse} disabled={!questResponse.trim()}
                  style={{ width: '100%', background: questResponse.trim() ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.75rem', color: '#fff', fontSize: '1.1rem', fontWeight: 700, padding: '1rem', cursor: questResponse.trim() ? 'pointer' : 'default', boxShadow: questResponse.trim() ? '0 4px 12px rgba(34,197,94,0.3)' : 'none', transition: 'all 0.2s' }}>
                  ✅ Submit Response
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <h3 style={{ color: '#22c55e', marginBottom: '0.5rem' }}>Response Submitted!</h3>
                <p style={{ color: '#94a3b8' }}>Waiting for the facilitator to debrief and award points...</p>
              </div>
            )}
          </div>
        )}

        {/* REVEAL - Attack */}
        {room.status === 'reveal' && room.mode === 'attack' && currentQ && (
          <div>
            {myResult ? (
              <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '1.5rem', background: myResult.correct ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: '1.25rem', border: `2px solid ${myResult.correct ? '#22c55e' : '#ef4444'}` }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>{myResult.correct ? '🎉' : '😔'}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: myResult.correct ? '#4ade80' : '#f87171' }}>
                  {myResult.correct ? 'Correct!' : 'Incorrect'}
                </div>
                {myResult.points > 0 && <div style={{ fontSize: '1.3rem', color: '#fbbf24', marginTop: '0.25rem' }}>+{myResult.points} points</div>}
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '1rem' }}>
                <p style={{ color: '#94a3b8' }}>You didn't submit an answer.</p>
              </div>
            )}

            <div style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.5rem' }}>CORRECT ANSWER</div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{OPTION_LABELS[currentQ.correctIndex]}. {currentQ.options[currentQ.correctIndex]}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1.25rem', color: '#cbd5e1', lineHeight: 1.7, fontSize: '0.95rem' }}>
              💡 {currentQ.explanation}
            </div>
            {currentQ.funFact && (
              <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '1rem', padding: '1rem 1.25rem', marginTop: '0.75rem', color: '#a5b4fc', fontSize: '0.9rem' }}>
                🤓 {currentQ.funFact}
              </div>
            )}
          </div>
        )}

        {/* REVEAL - Quest */}
        {room.status === 'reveal' && room.mode === 'quest' && currentScenario && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎭</div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Debrief in Progress</h3>
              <p style={{ color: '#94a3b8' }}>The facilitator is reviewing responses and awarding points.</p>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '1rem', padding: '1.25rem' }}>
              <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.75rem' }}>🛡️ Key Protection Measures</div>
              {currentScenario.protectionTips.map((tip, i) => (
                <div key={i} style={{ color: '#d1fae5', fontSize: '0.95rem', marginBottom: '0.4rem' }}>• {tip}</div>
              ))}
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {room.status === 'leaderboard' && (
          <div>
            <h2 style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '1.5rem' }}>🏆 Leaderboard</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[...nonHostPlayers].sort((a, b) => b.score - a.score).slice(0, 10).map((p, i) => {
                const isMe = p.id === playerId;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: isMe ? 'rgba(99,102,241,0.2)' : i === 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', border: isMe ? '2px solid #6366f1' : `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'transparent'}` }}>
                    <span style={{ width: 36, textAlign: 'center', fontSize: '1.3rem' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.avatar_color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontWeight: isMe ? 800 : 600, flex: 1 }}>{p.player_name}{isMe ? ' (You)' : ''}</span>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', color: i === 0 ? '#fbbf24' : '#e2e8f0' }}>{p.score.toLocaleString()}</span>
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
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Game Over!</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Thanks for playing — you scored <strong style={{ color: '#fbbf24' }}>{player.score.toLocaleString()} points</strong> and finished #{myRank}!</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
              {[...nonHostPlayers].sort((a, b) => b.score - a.score).map((p, i) => {
                const isMe = p.id === playerId;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: isMe ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', border: isMe ? '2px solid #6366f1' : 'transparent' }}>
                    <span style={{ width: 28, textAlign: 'center', fontWeight: 700 }}>#{i + 1}</span>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.avatar_color, display: 'inline-block' }} />
                    <span style={{ fontWeight: isMe ? 800 : 600, flex: 1 }}>{p.player_name}{isMe ? ' (You)' : ''}</span>
                    <span style={{ fontWeight: 800, color: '#fbbf24' }}>{p.score.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            <a href="/game" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', textDecoration: 'none', borderRadius: '0.75rem', padding: '0.875rem 2rem', fontWeight: 700, fontSize: '1.1rem', display: 'inline-block' }}>🏠 Play Again</a>
          </div>
        )}
      </div>
    </div>
  );
}
