'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SECTORS } from '@/lib/game-data';
import { generateRoomCode } from '@/lib/game-utils';
import { PLAYER_ICONS, encodePlayerName, parsePlayerName } from '@/lib/player-utils';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Step = 'home' | 'sector' | 'setup' | 'join';

function GameHomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('home');
  const [selectedSector, setSelectedSector] = useState('');
  const [hostName, setHostName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>(() => PLAYER_ICONS[Math.floor(Math.random() * PLAYER_ICONS.length)]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill room code from QR code URL param and jump to join step
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setJoinCode(code.toUpperCase());
      setStep('join');
    }
  }, [searchParams]);

  async function createRoom() {
    if (!hostName.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      const code = generateRoomCode();
      const { error: roomErr } = await getSupabase().from('game_rooms').insert({
        room_code: code,
        sector: selectedSector,
        mode: 'attack',
        status: 'lobby',
      });
      if (roomErr) throw roomErr;

      const { error: playerErr } = await getSupabase().from('game_players').insert({
        room_code: code,
        player_name: hostName.trim(),
        is_host: true,
        avatar_color: '#6366f1',
      });
      if (playerErr) throw playerErr;

      localStorage.setItem('game_player_name', hostName.trim());
      localStorage.setItem('game_is_host', 'true');
      router.push(`/game/${code}/host`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (!playerName.trim()) { setError('Please enter your name'); return; }
    if (!joinCode.trim()) { setError('Please enter a room code'); return; }
    setLoading(true);
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      const { data: room, error: roomErr } = await getSupabase()
        .from('game_rooms')
        .select('*')
        .eq('room_code', code)
        .single();
      if (roomErr || !room) throw new Error('Room not found. Check the code and try again.');
      if (room.status === 'ended') throw new Error('This game has already ended.');

      // Resolve duplicate display names (ignoring icon prefix)
      const displayName = playerName.trim();
      const { data: existingPlayers } = await getSupabase()
        .from('game_players')
        .select('player_name')
        .eq('room_code', code);
      const takenDisplayNames = new Set(
        (existingPlayers || []).map((p: { player_name: string }) => parsePlayerName(p.player_name).name)
      );
      let resolvedDisplay = displayName;
      if (takenDisplayNames.has(resolvedDisplay)) {
        let n = 1;
        while (takenDisplayNames.has(`${displayName} (${n})`)) n++;
        resolvedDisplay = `${displayName} (${n})`;
      }
      const resolvedName = encodePlayerName(selectedIcon, resolvedDisplay);

      const { data: newPlayer, error: playerErr } = await getSupabase().from('game_players').insert({
        room_code: code,
        player_name: resolvedName,
        is_host: false,
        // Use only colours NOT in TEAM_COLORS so every new player starts unassigned
        avatar_color: ['#f97316','#eab308','#06b6d4','#6366f1','#a855f7','#ec4899','#14b8a6','#f59e0b','#10b981'][Math.floor(Math.random()*9)],
      }).select('id').single();
      if (playerErr) throw playerErr;

      localStorage.setItem('game_player_name', playerName.trim());
      localStorage.setItem('game_is_host', 'false');
      router.push(`/game/${code}/play?playerId=${newPlayer.id}`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="join-page" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {step === 'home' && (
        <div style={{ textAlign: 'center', maxWidth: 700, width: '100%' }}>
          {/* Title */}
          <div style={{ marginBottom: '1rem' }}>
            <h1 style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 900,
              color: '#fff',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-1px',
            }}>
              CYBER ESSENTIALS
            </h1>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              fontWeight: 700,
              color: '#818cf8',
              margin: '0.25rem 0 0',
            }}>
              IN ACTION
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginTop: '0.75rem' }}>
              A cybersecurity awareness game
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(200,16,46,0.12)', border: '1px solid rgba(200,16,46,0.3)', borderRadius: '0.625rem', padding: '0.45rem 1rem', marginTop: '0.75rem' }}>
              <span style={{ color: '#fca5a5', fontSize: '0.85rem', fontWeight: 600 }}>
                Based on CSA Singapore&apos;s <span style={{ color: '#fff' }}>Cyber Essentials Mark</span> framework
              </span>
            </div>
          </div>

          {/* Two big action buttons */}
          <div className="join-home-btns">
            <button
              className="join-home-btn"
              onClick={() => setStep('sector')}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                border: 'none',
                borderRadius: '1rem',
                padding: '1.25rem 2rem',
                fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                minHeight: 56,
              }}
              onMouseOver={e => { (e.target as HTMLElement).style.transform = 'translateY(-3px)'; }}
              onMouseOut={e => { (e.target as HTMLElement).style.transform = 'none'; }}
            >
              🎯 Host Game
            </button>
            <button
              className="join-home-btn"
              onClick={() => setStep('join')}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
                color: '#fff',
                border: 'none',
                borderRadius: '1rem',
                padding: '1.25rem 2rem',
                fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(6,182,212,0.4)',
                transition: 'transform 0.15s',
                minHeight: 56,
              }}
              onMouseOver={e => { (e.target as HTMLElement).style.transform = 'translateY(-3px)'; }}
              onMouseOut={e => { (e.target as HTMLElement).style.transform = 'none'; }}
            >
              🙋 Join Game
            </button>
          </div>

          {/* Game mode preview */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: '⚡', title: 'Cyber Attack', desc: '24 quick-fire MCQ questions · 1 min each · Speed scoring', color: '#f97316' },
              { icon: '🎭', title: 'Cyber Quest', desc: '9 real-world scenarios · Role-play · 3 min each', color: '#22c55e' },
            ].map(m => (
              <div key={m.title} style={{
                background: 'rgba(255,255,255,0.05)',
                border: `2px solid ${m.color}40`,
                borderRadius: '1rem',
                padding: '1.25rem 1.5rem',
                flex: '1 1 200px',
                maxWidth: 280,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{m.icon}</div>
                <div style={{ color: m.color, fontWeight: 700, fontSize: '1.1rem' }}>{m.title}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step: Sector Selection */}
      {step === 'sector' && (
        <div style={{ maxWidth: 700, width: '100%' }}>
          <button onClick={() => setStep('home')} style={backBtn}>← Back</button>
          <h2 style={titleStyle}>Select Your Clinic / Sector</h2>
          <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            Choose the type of cyber health clinic or sector for this session
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {SECTORS.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedSector(s.id); setStep('setup'); }}
                style={{
                  background: selectedSector === s.id
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'rgba(255,255,255,0.06)',
                  border: `2px solid ${selectedSector === s.id ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                  color: '#fff',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.label}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Host Setup */}
      {step === 'setup' && (
        <div style={{ maxWidth: 480, width: '100%' }}>
          <button onClick={() => setStep('sector')} style={backBtn}>← Back</button>
          <h2 style={titleStyle}>Host Setup</h2>
          <div style={card}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Your Name (Facilitator)</label>
              <input
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="e.g. Alex"
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && createRoom()}
              />
            </div>
            <div style={{ background: 'rgba(99,102,241,0.15)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ color: '#a5b4fc', fontWeight: 600, marginBottom: '0.5rem' }}>Session Settings</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.95rem' }}>
                📍 Sector: <strong>{SECTORS.find(s => s.id === selectedSector)?.label}</strong>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                You will select the game mode (Cyber Attack or Cyber Quest) in the host panel.
              </div>
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <button onClick={createRoom} disabled={loading} style={primaryBtn}>
              {loading ? '⏳ Creating Room...' : '🚀 Create Game Room'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Join Game */}
      {step === 'join' && (
        <div style={{ maxWidth: 480, width: '100%' }}>
          <button onClick={() => setStep('home')} style={backBtn}>← Back</button>
          <h2 style={titleStyle}>Join a Game</h2>
          <div style={card}>
            {/* Icon picker */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Choose Your Icon</label>
              <div className="icon-picker-grid" style={{ marginTop: '0.5rem' }}>
                {PLAYER_ICONS.map(icon => (
                  <button key={icon} onClick={() => setSelectedIcon(icon)}
                    style={{ fontSize: '1.5rem', background: selectedIcon === icon ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)', border: `2px solid ${selectedIcon === icon ? '#6366f1' : 'transparent'}`, borderRadius: '0.625rem', padding: '0.35rem', cursor: 'pointer', transition: 'all 0.1s', lineHeight: 1 }}
                    title={icon}>
                    {icon}
                  </button>
                ))}
              </div>
              {/* Preview badge */}
              {playerName.trim() && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '0.625rem', padding: '0.45rem 0.875rem', width: 'fit-content' }}>
                  <span style={{ fontSize: '1.4rem' }}>{selectedIcon}</span>
                  <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{playerName.trim()}</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Your Name</label>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="e.g. Sarah"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Room Code</label>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                style={{ ...inputStyle, fontSize: '2rem', textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700 }}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
              />
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <button onClick={joinRoom} disabled={loading} style={primaryBtn}>
              {loading ? '⏳ Joining...' : `${selectedIcon} Join Game`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GameHomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading…</div>}>
      <GameHomePageInner />
    </Suspense>
  );
}

// Shared styles
const backBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0.5rem 0',
  marginBottom: '1rem',
  display: 'block',
};

const titleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
  fontWeight: 800,
  textAlign: 'center',
  margin: '0 0 1.5rem',
};

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '1.5rem',
  padding: '2rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#94a3b8',
  fontSize: '0.9rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.08)',
  border: '2px solid rgba(255,255,255,0.15)',
  borderRadius: '0.75rem',
  padding: '0.875rem 1rem',
  color: '#fff',
  fontSize: '1.2rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: '#fff',
  border: 'none',
  borderRadius: '0.875rem',
  padding: '1rem',
  fontSize: '1.2rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
};

const errorStyle: React.CSSProperties = {
  background: 'rgba(239,68,68,0.15)',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: '0.5rem',
  color: '#fca5a5',
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  fontSize: '0.95rem',
};
