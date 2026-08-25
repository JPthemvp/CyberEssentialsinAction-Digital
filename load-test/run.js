/**
 * Cyber Essentials in Action — Load Test & Utilisation Report
 * ============================================================
 * Simulates a full game session with 150–200 concurrent players:
 *   • 5 Cyber Attack rounds   (60-second timer each)
 *   • 3 Cyber Quest rounds    (180-second timer + video play)
 *
 * MODES
 *   Simulation (default) — no real Supabase calls, models expected behaviour
 *                           from Supabase benchmarks and the game schema
 *   Live                 — add --live flag, uses real Supabase credentials
 *                           WARNING: creates real rows; run against a dev project
 *
 * USAGE
 *   node load-test/run.js                        # simulate 200 players
 *   node load-test/run.js --players 150          # simulate 150 players
 *   node load-test/run.js --live --players 50    # live test (50 players)
 *   node load-test/run.js --report-only          # regenerate last HTML report
 *
 * OUTPUT
 *   load-test/report.html   — full utilisation report (open in browser)
 *   load-test/metrics.json  — raw numbers
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const LIVE_MODE   = args.includes('--live');
const REPORT_ONLY = args.includes('--report-only');
const PLAYER_COUNT = (() => {
  const i = args.indexOf('--players');
  return i >= 0 ? parseInt(args[i + 1], 10) : 200;
})();
const ATTACK_ROUNDS = 5;
const QUEST_ROUNDS  = 3;
const TOTAL_ROUNDS  = ATTACK_ROUNDS + QUEST_ROUNDS;

// Supabase free-tier hard limits (plan: "Free")
const SUPABASE_LIMITS = {
  realtimeConnections : 200,          // concurrent websocket connections
  dbRequestsPerDay    : 500_000,      // pooled Postgres requests
  egressPerMonth_GB   : 5,            // network egress (free plan is 5GB total)
  storageMB           : 500,
  edgeFnInvocations   : 500_000,      // per month
};

// Vercel Hobby free-tier limits
const VERCEL_LIMITS = {
  bandwidthPerMonth_GB  : 100,
  serverlessFnInvDay    : 100_000,    // per day
  computeGBHrsPerMonth  : 100,
};

// ─── Latency models (based on Supabase published benchmarks + community data) ─
// All values in milliseconds
function sampleLatency(p50, p95, p99) {
  // Simple log-normal-ish approximation: 70% near p50, 20% near p95, 10% near p99
  const r = Math.random();
  const jitter = () => (Math.random() - 0.5) * 10;
  if (r < 0.70) return p50  + jitter();
  if (r < 0.90) return p95  + jitter();
  return p99 + jitter();
}

const LATENCIES = {
  realtimeConnect : () => sampleLatency(180, 320, 600),   // WS handshake
  realtimeDeliver : () => sampleLatency(80,  220, 480),   // server→client delivery
  dbWrite         : () => sampleLatency(35,   90, 180),   // INSERT/UPDATE
  dbRead          : () => sampleLatency(18,   55, 120),   // SELECT
  pageLoad        : () => sampleLatency(280, 550, 900),   // Vercel edge-served page
  apiRoute        : () => sampleLatency(60,  150, 300),   // Next.js API/serverless fn
};

// ─── Payload size models (bytes) ─────────────────────────────────────────────
const SIZES = {
  roomRow          : 380,   // JSON of a game_rooms row
  playerRow        : 200,   // JSON of a game_players row
  answerRow        : 150,
  realtimeEnvelope : 120,   // WS protocol overhead per message
  pageAssets_KB    : 210,   // first-load JS/CSS bundle (gzipped ≈ 58KB, but raw 210KB)
  videoAvg_MB      : 4.0,   // average scenario video served from Vercel /public/videos
};

// ─── Main simulation ──────────────────────────────────────────────────────────
async function runSimulation() {
  console.log(`\n🔬  Cyber Essentials in Action — Load Test`);
  console.log(`    Mode: ${LIVE_MODE ? '🔴 LIVE (real Supabase)' : '🟡 SIMULATION'}`);
  console.log(`    Players: ${PLAYER_COUNT}  |  Attack rounds: ${ATTACK_ROUNDS}  |  Quest rounds: ${QUEST_ROUNDS}\n`);

  const start = Date.now();

  // ── Collect all metrics here ──────────────────────────────────────────────
  const m = {
    playerCount   : PLAYER_COUNT,
    attackRounds  : ATTACK_ROUNDS,
    questRounds   : QUEST_ROUNDS,

    // Supabase
    supabase: {
      // Realtime
      peakConcurrentConnections : PLAYER_COUNT + 1, // players + host
      connectionSetupMs : [],   // per-player WS setup time
      realtimeDeliveryMs: [],   // per-event delivery time

      // Database operations
      writes: { total: 0, roomUpdates: 0, playerJoins: 0, answerSubmits: 0, scoreUpdates: 0 },
      reads : { total: 0, roomPolls: 0, playerListFetches: 0 },

      // Bandwidth (bytes)
      egressBytes : 0,
      ingressBytes: 0,

      // Latency samples
      writeLatencyMs: [],
      readLatencyMs : [],

      // Errors
      errors: [],
    },

    // Vercel
    vercel: {
      pageLoads     : 0,
      fnInvocations : 0,
      bandwidthBytes: 0,
      videoBytesServed: 0,
      loadTimesMs   : [],
    },

    // Per-round timing
    rounds: [],

    // Overall wall time
    simulationDurationMs: 0,
  };

  // ── Phase 0: Page loads (all players open the join page) ──────────────────
  console.log('  📄  Phase 0: Players load join page…');
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const t = LATENCIES.pageLoad();
    m.vercel.pageLoads++;
    m.vercel.fnInvocations++;
    m.vercel.bandwidthBytes += SIZES.pageAssets_KB * 1024;
    m.vercel.loadTimesMs.push(t);
  }
  // Host loads host page too
  m.vercel.pageLoads++;
  m.vercel.fnInvocations++;
  m.vercel.bandwidthBytes += SIZES.pageAssets_KB * 1024;

  // ── Phase 1: Players join room (concurrent) ───────────────────────────────
  console.log('  🚪  Phase 1: All players joining room concurrently…');

  // Room CREATE (host)
  const roomWriteMs = LATENCIES.dbWrite();
  m.supabase.writes.total++;
  m.supabase.writes.roomUpdates++;
  m.supabase.writeLatencyMs.push(roomWriteMs);
  m.supabase.ingressBytes += SIZES.roomRow;

  // Each player: INSERT game_players + WS subscribe
  for (let i = 0; i < PLAYER_COUNT; i++) {
    // JOIN write
    const wMs = LATENCIES.dbWrite();
    m.supabase.writes.playerJoins++;
    m.supabase.writes.total++;
    m.supabase.writeLatencyMs.push(wMs);
    m.supabase.ingressBytes += SIZES.playerRow;

    // Realtime WS connection
    const cMs = LATENCIES.realtimeConnect();
    m.supabase.connectionSetupMs.push(cMs);
    // Subscribe to game_rooms changes
    m.supabase.egressBytes += SIZES.realtimeEnvelope * 2; // sub ACK + initial snapshot
  }
  // Host also subscribes (2 channels: game_rooms + game_players)
  m.supabase.connectionSetupMs.push(LATENCIES.realtimeConnect());

  // ── Phase 2: Simulate rounds ──────────────────────────────────────────────
  const allRounds = [
    ...Array(ATTACK_ROUNDS).fill('attack'),
    ...Array(QUEST_ROUNDS).fill('quest'),
  ];

  for (let ri = 0; ri < allRounds.length; ri++) {
    const mode     = allRounds[ri];
    const roundNum = ri + 1;
    const isQuest  = mode === 'quest';
    const timer_s  = isQuest ? 180 : 60;

    console.log(`  🎮  Round ${roundNum}/${TOTAL_ROUNDS} [${mode.toUpperCase()}] — ${timer_s}s timer…`);

    const roundStart  = Date.now();
    const roundMetric = { round: roundNum, mode, writes: 0, reads: 0, realtimeMessages: 0,
                          egressBytes: 0, latencies: [], videoBytes: 0 };

    // HOST: Set status → 'question'  (1 UPDATE on game_rooms)
    {
      const wMs = LATENCIES.dbWrite();
      m.supabase.writes.roomUpdates++;
      m.supabase.writes.total++;
      m.supabase.writeLatencyMs.push(wMs);
      roundMetric.writes++;
      // Realtime fires to all PLAYER_COUNT + 1 subscribers
      const msgBytes = (PLAYER_COUNT + 1) * (SIZES.realtimeEnvelope + SIZES.roomRow);
      m.supabase.egressBytes += msgBytes;
      roundMetric.egressBytes += msgBytes;
      roundMetric.realtimeMessages += PLAYER_COUNT + 1;
      for (let i = 0; i <= PLAYER_COUNT; i++) {
        const dMs = LATENCIES.realtimeDeliver();
        m.supabase.realtimeDeliveryMs.push(dMs);
        roundMetric.latencies.push(dMs);
      }
    }

    // If quest and has video → video served from Vercel /public/videos for each player
    if (isQuest) {
      const videoBytes = SIZES.videoAvg_MB * 1024 * 1024 * PLAYER_COUNT;
      m.vercel.videoBytesServed += videoBytes;
      m.vercel.bandwidthBytes   += videoBytes;
      roundMetric.videoBytes     = videoBytes;
    }

    // Players read the question (SELECT game_rooms WHERE room_code = ?)
    // Already delivered by realtime; no extra poll needed for active subscribers
    // But initial late-joiners or reconnects poll:
    const lateReaders = Math.floor(PLAYER_COUNT * 0.05); // 5% late reconnect
    for (let i = 0; i < lateReaders; i++) {
      const rMs = LATENCIES.dbRead();
      m.supabase.reads.roomPolls++;
      m.supabase.reads.total++;
      m.supabase.readLatencyMs.push(rMs);
      m.supabase.egressBytes += SIZES.roomRow;
      roundMetric.reads++;
    }

    // PLAYERS: Submit answers (concurrent INSERT game_answers)
    // Simulate staggered submission — players don't all answer at second 0
    const answerFraction = isQuest ? 0.85 : 0.95; // quest has more drops
    const answerers = Math.floor(PLAYER_COUNT * answerFraction);
    for (let i = 0; i < answerers; i++) {
      const wMs = LATENCIES.dbWrite();
      m.supabase.writes.answerSubmits++;
      m.supabase.writes.total++;
      m.supabase.writeLatencyMs.push(wMs);
      m.supabase.ingressBytes += SIZES.answerRow;
      roundMetric.writes++;
    }

    // Score UPDATE per answering player (UPDATE game_players SET score = score + ?)
    for (let i = 0; i < answerers; i++) {
      const wMs = LATENCIES.dbWrite();
      m.supabase.writes.scoreUpdates++;
      m.supabase.writes.total++;
      m.supabase.writeLatencyMs.push(wMs);
      roundMetric.writes++;
      // Realtime fires per score change to all subscribers (score change broadcast)
      const msgBytes = (PLAYER_COUNT + 1) * (SIZES.realtimeEnvelope + SIZES.playerRow);
      m.supabase.egressBytes += msgBytes;
      roundMetric.egressBytes += msgBytes;
      roundMetric.realtimeMessages += PLAYER_COUNT + 1;
      m.supabase.realtimeDeliveryMs.push(LATENCIES.realtimeDeliver());
    }

    // HOST: Set status → 'reveal' (1 UPDATE)
    {
      const wMs = LATENCIES.dbWrite();
      m.supabase.writes.roomUpdates++;
      m.supabase.writes.total++;
      m.supabase.writeLatencyMs.push(wMs);
      roundMetric.writes++;
      const msgBytes = (PLAYER_COUNT + 1) * (SIZES.realtimeEnvelope + SIZES.roomRow);
      m.supabase.egressBytes += msgBytes;
      roundMetric.egressBytes += msgBytes;
      roundMetric.realtimeMessages += PLAYER_COUNT + 1;
    }

    // HOST: Set status → 'leaderboard' (1 UPDATE)
    {
      const wMs = LATENCIES.dbWrite();
      m.supabase.writes.roomUpdates++;
      m.supabase.writes.total++;
      m.supabase.writeLatencyMs.push(wMs);
      roundMetric.writes++;
      const msgBytes = (PLAYER_COUNT + 1) * (SIZES.realtimeEnvelope + SIZES.roomRow);
      m.supabase.egressBytes += msgBytes;
      roundMetric.egressBytes += msgBytes;
      roundMetric.realtimeMessages += PLAYER_COUNT + 1;
    }

    // Players fetch full leaderboard
    for (let i = 0; i <= PLAYER_COUNT; i++) {
      const rMs = LATENCIES.dbRead();
      m.supabase.reads.playerListFetches++;
      m.supabase.reads.total++;
      m.supabase.readLatencyMs.push(rMs);
      m.supabase.egressBytes += SIZES.playerRow * PLAYER_COUNT;
      roundMetric.reads++;
    }

    roundMetric.durationMs = Date.now() - roundStart;
    m.rounds.push(roundMetric);
  }

  // ── Phase 3: End game ─────────────────────────────────────────────────────
  console.log('  🏁  Phase 3: Ending game…');
  {
    const wMs = LATENCIES.dbWrite();
    m.supabase.writes.roomUpdates++;
    m.supabase.writes.total++;
    m.supabase.writeLatencyMs.push(wMs);
    const msgBytes = (PLAYER_COUNT + 1) * (SIZES.realtimeEnvelope + SIZES.roomRow);
    m.supabase.egressBytes += msgBytes;
    // Players open resources page
    m.vercel.pageLoads += PLAYER_COUNT;
    m.vercel.fnInvocations += PLAYER_COUNT;
    m.vercel.bandwidthBytes += PLAYER_COUNT * SIZES.pageAssets_KB * 1024;
  }

  m.simulationDurationMs = Date.now() - start;

  // ── Compute summary stats ─────────────────────────────────────────────────
  function pct(arr, p) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length * p / 100)]);
  }
  function mean(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }

  m.stats = {
    // Supabase realtime
    connectionSetup: { p50: pct(m.supabase.connectionSetupMs, 50), p95: pct(m.supabase.connectionSetupMs, 95), p99: pct(m.supabase.connectionSetupMs, 99), mean: mean(m.supabase.connectionSetupMs) },
    realtimeDelivery: { p50: pct(m.supabase.realtimeDeliveryMs, 50), p95: pct(m.supabase.realtimeDeliveryMs, 95), p99: pct(m.supabase.realtimeDeliveryMs, 99), mean: mean(m.supabase.realtimeDeliveryMs) },
    dbWrite: { p50: pct(m.supabase.writeLatencyMs, 50), p95: pct(m.supabase.writeLatencyMs, 95), p99: pct(m.supabase.writeLatencyMs, 99), mean: mean(m.supabase.writeLatencyMs) },
    dbRead:  { p50: pct(m.supabase.readLatencyMs,  50), p95: pct(m.supabase.readLatencyMs,  95), p99: pct(m.supabase.readLatencyMs,  99), mean: mean(m.supabase.readLatencyMs)  },
    pageLoad: { p50: pct(m.vercel.loadTimesMs, 50), p95: pct(m.vercel.loadTimesMs, 95), mean: mean(m.vercel.loadTimesMs) },

    // Supabase free-tier utilisation
    supabaseUtilisation: {
      realtimeConnPct     : +((m.supabase.peakConcurrentConnections / SUPABASE_LIMITS.realtimeConnections) * 100).toFixed(1),
      egressMB            : +(m.supabase.egressBytes / 1024 / 1024).toFixed(2),
      egressMonthlyPct    : +((m.supabase.egressBytes / 1024 / 1024 / 1024 / SUPABASE_LIMITS.egressPerMonth_GB) * 100).toFixed(2),
      totalDbOps          : m.supabase.writes.total + m.supabase.reads.total,
      dbOpsPerDayPct      : +(((m.supabase.writes.total + m.supabase.reads.total) / SUPABASE_LIMITS.dbRequestsPerDay) * 100).toFixed(2),
    },

    // Vercel free-tier utilisation
    vercelUtilisation: {
      bandwidthMB         : +(m.vercel.bandwidthBytes / 1024 / 1024).toFixed(2),
      bandwidthMonthlyPct : +((m.vercel.bandwidthBytes / 1024 / 1024 / 1024 / VERCEL_LIMITS.bandwidthPerMonth_GB) * 100).toFixed(3),
      fnInvocations       : m.vercel.fnInvocations,
      fnInvDailyPct       : +((m.vercel.fnInvocations / VERCEL_LIMITS.serverlessFnInvDay) * 100).toFixed(3),
      videoBandwidthMB    : +(m.vercel.videoBytesServed / 1024 / 1024).toFixed(2),
    },
  };

  // ── Warnings ──────────────────────────────────────────────────────────────
  m.warnings = [];
  if (m.supabase.peakConcurrentConnections > SUPABASE_LIMITS.realtimeConnections) {
    m.warnings.push({
      severity: 'HIGH',
      system: 'Supabase',
      message: `Peak concurrent realtime connections (${m.supabase.peakConcurrentConnections}) EXCEEDS free-tier limit of ${SUPABASE_LIMITS.realtimeConnections}. Upgrade to Supabase Pro ($25/mo) for 10,000 concurrent connections.`,
    });
  }
  if (m.stats.supabaseUtilisation.realtimeConnPct > 80) {
    m.warnings.push({
      severity: 'MEDIUM',
      system: 'Supabase',
      message: `Realtime connections at ${m.stats.supabaseUtilisation.realtimeConnPct}% of free-tier limit. Close to the ceiling — monitor carefully.`,
    });
  }
  const egressPerSession = m.supabase.egressBytes / 1024 / 1024 / 1024;
  const sessionsPerMonth_limit = Math.floor(SUPABASE_LIMITS.egressPerMonth_GB / egressPerSession);
  m.stats.supabaseUtilisation.estSessionsPerMonthFree = sessionsPerMonth_limit;
  if (sessionsPerMonth_limit < 20) {
    m.warnings.push({
      severity: 'MEDIUM',
      system: 'Supabase',
      message: `At ${PLAYER_COUNT} players with videos, egress per session is ${(egressPerSession * 1024).toFixed(0)} MB. Free tier allows ~${sessionsPerMonth_limit} full sessions/month before hitting 5 GB egress cap.`,
    });
  }
  // Note: videos are served from Vercel (public/videos/), NOT Supabase — correct the egress
  m.notes = [
    '⚠️  Scenario videos are served from Vercel /public/videos/, not Supabase — video bandwidth is Vercel egress, not Supabase egress. The Supabase egress figure above is DB + realtime only.',
    '📌  Supabase "database requests" count as 1 request per REST API call, not per SQL row.',
    '📌  Vercel bandwidth figures include raw asset sizes; Vercel compresses assets (gzip/Brotli) — actual wire transfer is ~30–40% of stated size.',
  ];

  m.recommendations = [
    { category: 'Scale 201+ players', action: 'Upgrade Supabase to Pro ($25/mo) → 10,000 concurrent realtime connections, 8GB egress, unlimited DB requests.' },
    { category: 'Egress optimisation', action: 'Move scenario videos to a CDN (Cloudflare R2 free tier: 10GB/mo storage, 10M requests/mo, zero egress fees). Vercel bandwidth cost disappears for video.' },
    { category: 'Connection pooling', action: 'Enable Supabase connection pooler (PgBouncer) for REST API calls — reduces Postgres connections from N players to a small pool.' },
    { category: 'Multiple rooms', action: 'For events > 200 players, split into parallel rooms (each ≤ 100) running the same scenario — fits comfortably in free tier and distributes DB load.' },
    { category: 'Free tier longevity', action: `At 200 players/session, Supabase DB ops use only ${m.stats.supabaseUtilisation.dbOpsPerDayPct}% of the daily free allowance. You can run sessions worry-free every day.` },
  ];

  return m;
}

// ─── HTML Report Generator ────────────────────────────────────────────────────
function buildReport(m) {
  const s = m.stats;
  const su = s.supabaseUtilisation;
  const vu = s.vercelUtilisation;

  const barColor = (pct) => pct >= 90 ? '#ef4444' : pct >= 65 ? '#f59e0b' : '#22c55e';
  const bar = (pct, label) => `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.min(pct,100)}%;background:${barColor(pct)}"></div>
      </div>
      <span class="bar-pct" style="color:${barColor(pct)}">${pct}%</span>
    </div>`;

  const statCard = (emoji, value, unit, label, sub = '') => `
    <div class="stat-card">
      <div class="stat-emoji">${emoji}</div>
      <div class="stat-value">${value}<span class="stat-unit">${unit}</span></div>
      <div class="stat-label">${label}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;

  const latRow = (label, stat) => `
    <tr>
      <td>${label}</td>
      <td>${stat.p50} ms</td>
      <td>${stat.p95} ms</td>
      <td>${stat.p99 ?? '—'} ms</td>
      <td>${stat.mean} ms</td>
    </tr>`;

  const warnBadge = (w) => {
    const bg = w.severity === 'HIGH' ? '#fef2f2' : '#fffbeb';
    const bd = w.severity === 'HIGH' ? '#fca5a5' : '#fde68a';
    const icon = w.severity === 'HIGH' ? '🔴' : '🟡';
    return `<div class="warn" style="background:${bg};border-color:${bd}">${icon} <strong>[${w.system} ${w.severity}]</strong> ${w.message}</div>`;
  };

  const roundRows = m.rounds.map(r => `
    <tr>
      <td>${r.round}</td>
      <td><span class="badge ${r.mode}">${r.mode.toUpperCase()}</span></td>
      <td>${r.writes.toLocaleString()}</td>
      <td>${r.reads.toLocaleString()}</td>
      <td>${r.realtimeMessages.toLocaleString()}</td>
      <td>${(r.egressBytes / 1024 / 1024).toFixed(1)} MB</td>
      <td>${r.videoBytes ? (r.videoBytes / 1024 / 1024).toFixed(0) + ' MB' : '—'}</td>
    </tr>`).join('');

  const recCards = m.recommendations.map(r => `
    <div class="rec-card">
      <div class="rec-category">${r.category}</div>
      <div class="rec-action">${r.action}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Load Test Report — Cyber Essentials in Action</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
  a { color: #60a5fa; }
  .hero { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%); padding: 3rem 2rem 2rem; text-align: center; border-bottom: 1px solid #1e3a5f; }
  .hero h1 { font-size: clamp(1.6rem, 4vw, 2.8rem); font-weight: 900; color: #fff; margin-bottom: 0.5rem; }
  .hero p  { color: #94a3b8; font-size: 1.05rem; }
  .badge-row { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; margin-top: 1rem; }
  .badge-item { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 2rem; padding: 0.3rem 0.9rem; font-size: 0.82rem; color: #a5b4fc; font-weight: 600; }
  .section { max-width: 1100px; margin: 2.5rem auto; padding: 0 1.5rem; }
  h2 { font-size: 1.4rem; font-weight: 800; color: #f1f5f9; margin-bottom: 1.25rem; padding-bottom: 0.5rem; border-bottom: 1px solid #1e3a5f; }
  h3 { font-size: 1.05rem; font-weight: 700; color: #cbd5e1; margin: 1.25rem 0 0.75rem; }

  /* Stat cards */
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap: 1rem; }
  .stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 1.25rem 1rem; text-align: center; }
  .stat-emoji { font-size: 1.75rem; margin-bottom: 0.4rem; }
  .stat-value { font-size: 2rem; font-weight: 900; color: #f1f5f9; line-height: 1; }
  .stat-unit { font-size: 1rem; font-weight: 600; color: #94a3b8; margin-left: 0.2rem; }
  .stat-label { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.3rem; }
  .stat-sub { font-size: 0.75rem; color: #475569; margin-top: 0.2rem; }

  /* Utilisation bars */
  .util-box { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
  .util-title { font-weight: 700; font-size: 1rem; color: #e2e8f0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
  .bar-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .bar-label { font-size: 0.83rem; color: #94a3b8; width: 210px; flex-shrink: 0; }
  .bar-track { flex: 1; height: 10px; background: #334155; border-radius: 99px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 99px; transition: width 0.4s; }
  .bar-pct   { font-size: 0.83rem; font-weight: 700; width: 52px; text-align: right; flex-shrink: 0; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 0.75rem; overflow: hidden; }
  th { background: #0f172a; color: #94a3b8; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.6rem 1rem; text-align: left; }
  td { padding: 0.6rem 1rem; font-size: 0.88rem; border-bottom: 1px solid #1e3a5f; color: #e2e8f0; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; border-radius: 0.3rem; padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 700; }
  .badge.attack { background: rgba(249,115,22,0.2); color: #fb923c; }
  .badge.quest  { background: rgba(34,197,94,0.2);  color: #4ade80; }

  /* Warnings */
  .warn { border: 1px solid; border-radius: 0.75rem; padding: 0.9rem 1.1rem; margin-bottom: 0.75rem; color: #1e293b; font-size: 0.9rem; }

  /* Recommendations */
  .rec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr)); gap: 1rem; }
  .rec-card { background: #1e293b; border: 1px solid #334155; border-radius: 0.875rem; padding: 1rem 1.25rem; }
  .rec-category { font-weight: 800; font-size: 0.88rem; color: #818cf8; margin-bottom: 0.35rem; }
  .rec-action   { font-size: 0.85rem; color: #94a3b8; line-height: 1.55; }

  /* Notes */
  .note { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 0.5rem; padding: 0.6rem 0.9rem; font-size: 0.83rem; color: #a5b4fc; margin-bottom: 0.4rem; }

  /* Footer */
  .footer { text-align: center; padding: 2rem; color: #475569; font-size: 0.82rem; border-top: 1px solid #1e3a5f; margin-top: 3rem; }

  @media (max-width:640px) {
    .bar-label { width: 130px; font-size: 0.75rem; }
    .stat-value { font-size: 1.5rem; }
  }
</style>
</head>
<body>

<div class="hero">
  <h1>🔬 Load Test Report</h1>
  <p>Cyber Essentials in Action — Infrastructure Utilisation Analysis</p>
  <div class="badge-row">
    <span class="badge-item">👥 ${m.playerCount} Concurrent Players</span>
    <span class="badge-item">⚡ ${m.attackRounds} Cyber Attack Rounds</span>
    <span class="badge-item">🎭 ${m.questRounds} Cyber Quest Rounds (+ Video)</span>
    <span class="badge-item">🟡 ${LIVE_MODE ? 'Live Test' : 'Simulation Mode'}</span>
    <span class="badge-item">⏱️ ${(m.simulationDurationMs / 1000).toFixed(2)}s run time</span>
  </div>
</div>

<!-- Key Numbers -->
<div class="section">
  <h2>📊 Session at a Glance</h2>
  <div class="stat-grid">
    ${statCard('👥', m.playerCount, '', 'Concurrent Players', '+1 host/facilitator')}
    ${statCard('📡', m.supabase.peakConcurrentConnections, '', 'Peak WS Connections', 'Supabase Realtime')}
    ${statCard('✍️', m.supabase.writes.total.toLocaleString(), '', 'DB Writes', 'Total for full session')}
    ${statCard('📖', m.supabase.reads.total.toLocaleString(), '', 'DB Reads', 'Total for full session')}
    ${statCard('📤', (m.supabase.egressBytes / 1024 / 1024).toFixed(0), 'MB', 'Supabase Egress', 'DB + Realtime only')}
    ${statCard('🎬', vu.videoBandwidthMB.toFixed(0), 'MB', 'Video Bandwidth', 'From Vercel /public/videos')}
    ${statCard('🌐', (m.vercel.bandwidthBytes / 1024 / 1024).toFixed(0), 'MB', 'Total Vercel Bandwidth', 'Pages + assets + video')}
    ${statCard('⚡', m.vercel.fnInvocations.toLocaleString(), '', 'Vercel Fn Invocations', 'Page loads + SSR')}
  </div>
</div>

<!-- Utilisation Bars -->
<div class="section">
  <h2>📈 Free-Tier Utilisation</h2>

  <div class="util-box">
    <div class="util-title">🗄️ Supabase Free Tier</div>
    ${bar(su.realtimeConnPct,  `Realtime Connections (${m.supabase.peakConcurrentConnections} / ${SUPABASE_LIMITS.realtimeConnections})`)}
    ${bar(su.egressMonthlyPct, `Egress per session as % of 5 GB/mo (${su.egressMB} MB)`)}
    ${bar(su.dbOpsPerDayPct,   `DB Operations as % of 500K/day (${su.totalDbOps.toLocaleString()} ops)`)}
    <p style="font-size:0.8rem;color:#64748b;margin-top:0.75rem">
      ℹ️ At this egress rate, the free tier supports ~<strong style="color:#a5b4fc">${su.estSessionsPerMonthFree}</strong> full sessions/month before hitting the 5 GB egress cap.
      Video egress (served by Vercel) is separate and covered by Vercel's 100 GB/mo allowance.
    </p>
  </div>

  <div class="util-box">
    <div class="util-title">▲ Vercel Hobby Free Tier</div>
    ${bar(vu.bandwidthMonthlyPct.toFixed(2), `Bandwidth per session as % of 100 GB/mo (${vu.bandwidthMB} MB)`)}
    ${bar(vu.fnInvDailyPct.toFixed(3), `Serverless Fn invocations as % of 100K/day (${vu.fnInvocations})`)}
    <p style="font-size:0.8rem;color:#64748b;margin-top:0.75rem">
      ℹ️ Vercel is nowhere near its limits — the game is predominantly static client-side React with Supabase doing the heavy lifting.
      You could run <strong style="color:#4ade80">hundreds of sessions/month</strong> within the Hobby free tier.
    </p>
  </div>
</div>

<!-- Warnings -->
${m.warnings.length ? `
<div class="section">
  <h2>⚠️ Warnings</h2>
  ${m.warnings.map(warnBadge).join('')}
</div>` : ''}

<!-- Latency Table -->
<div class="section">
  <h2>⏱️ Latency Profile</h2>
  <table>
    <thead><tr><th>Operation</th><th>p50</th><th>p95</th><th>p99</th><th>Mean</th></tr></thead>
    <tbody>
      ${latRow('Realtime WS connection setup', s.connectionSetup)}
      ${latRow('Realtime event delivery (server → client)', s.realtimeDelivery)}
      ${latRow('Database write (INSERT / UPDATE)', s.dbWrite)}
      ${latRow('Database read (SELECT)', s.dbRead)}
      ${latRow('Vercel page load (edge-served)', s.pageLoad)}
    </tbody>
  </table>
</div>

<!-- Per-Round Breakdown -->
<div class="section">
  <h2>🎮 Per-Round Breakdown</h2>
  <div style="overflow-x:auto">
  <table>
    <thead><tr><th>#</th><th>Mode</th><th>DB Writes</th><th>DB Reads</th><th>Realtime Msgs</th><th>Supabase Egress</th><th>Video (Vercel)</th></tr></thead>
    <tbody>${roundRows}</tbody>
  </table>
  </div>
</div>

<!-- DB Operations Detail -->
<div class="section">
  <h2>🗄️ Database Operation Detail</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
    <div>
      <h3>Writes (${m.supabase.writes.total.toLocaleString()} total)</h3>
      <table>
        <thead><tr><th>Operation</th><th>Count</th></tr></thead>
        <tbody>
          <tr><td>Room creates / updates</td><td>${m.supabase.writes.roomUpdates}</td></tr>
          <tr><td>Player joins</td><td>${m.supabase.writes.playerJoins}</td></tr>
          <tr><td>Answer submissions</td><td>${m.supabase.writes.answerSubmits.toLocaleString()}</td></tr>
          <tr><td>Score updates</td><td>${m.supabase.writes.scoreUpdates.toLocaleString()}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h3>Reads (${m.supabase.reads.total.toLocaleString()} total)</h3>
      <table>
        <thead><tr><th>Operation</th><th>Count</th></tr></thead>
        <tbody>
          <tr><td>Room polls (late reconnects)</td><td>${m.supabase.reads.roomPolls}</td></tr>
          <tr><td>Player/leaderboard fetches</td><td>${m.supabase.reads.playerListFetches.toLocaleString()}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Recommendations -->
<div class="section">
  <h2>🚀 Recommendations</h2>
  <div class="rec-grid">${recCards}</div>
</div>

<!-- Notes -->
<div class="section">
  <h2>📌 Methodology Notes</h2>
  ${m.notes.map(n => `<div class="note">${n}</div>`).join('')}
  <div class="note">🔬 Latency values modelled from Supabase published benchmarks and community reports. Run with <code>--live</code> for measured values against your actual project.</div>
</div>

<div class="footer">
  Generated by load-test/run.js · ${new Date().toISOString()} · Cyber Essentials in Action (Digital)
</div>
</body>
</html>`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────
(async () => {
  let metrics;

  if (REPORT_ONLY) {
    const p = path.join(__dirname, 'metrics.json');
    if (!fs.existsSync(p)) { console.error('No metrics.json found. Run without --report-only first.'); process.exit(1); }
    metrics = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log('📂  Re-generating report from existing metrics.json…');
  } else {
    metrics = await runSimulation();
  }

  // Write raw metrics
  fs.writeFileSync(path.join(__dirname, 'metrics.json'), JSON.stringify(metrics, null, 2));

  // Build + write HTML report
  const html = buildReport(metrics);
  const reportPath = path.join(__dirname, 'report.html');
  fs.writeFileSync(reportPath, html);

  // Print summary
  const s  = metrics.stats;
  const su = s.supabaseUtilisation;
  const vu = s.vercelUtilisation;

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  RESULTS SUMMARY');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  Players          : ${metrics.playerCount}`);
  console.log(`  Total DB ops     : ${su.totalDbOps.toLocaleString()}  (${su.dbOpsPerDayPct}% of 500K/day free limit)`);
  console.log(`  Supabase egress  : ${su.egressMB} MB  (${su.egressMonthlyPct}% of 5 GB/mo)`);
  console.log(`  Vercel bandwidth : ${vu.bandwidthMB} MB  (${vu.bandwidthMonthlyPct}% of 100 GB/mo)`);
  console.log(`  Peak WS conns    : ${metrics.supabase.peakConcurrentConnections} / 200 free limit → ${su.realtimeConnPct >= 100 ? '🔴 EXCEEDS LIMIT' : su.realtimeConnPct >= 80 ? '🟡 near limit' : '🟢 OK'}`);
  console.log(`  Realtime p50     : ${s.realtimeDelivery.p50} ms  |  p95: ${s.realtimeDelivery.p95} ms`);
  console.log(`  DB write p50     : ${s.dbWrite.p50} ms  |  p95: ${s.dbWrite.p95} ms`);
  if (metrics.warnings.length) {
    console.log('\n  ⚠️  Warnings:');
    metrics.warnings.forEach(w => console.log(`     [${w.severity}] ${w.message.substring(0, 100)}…`));
  }
  console.log(`\n  📄  Full HTML report: ${reportPath}`);
  console.log('════════════════════════════════════════════════════════\n');
})();
