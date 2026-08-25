'use client';

import { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'profile' | 'questions' | 'results';
type Ans  = 'yes' | 'partial' | 'no' | null;
interface Profile {
  sector: string; years: string; employees: string; turnover: string;
  uen: string; companyName: string; psgRef: string;
}

// ─── CISO-as-a-Service Providers (CSA listing, ranked by track record) ───────
const CISO_PROVIDERS = [
  { rank:1,  name:'CyberSafe Pte Ltd',                     contact:'Dave Gurbani',     email:'dave@cybersafe.sg',                     phone:'8725 9789' },
  { rank:2,  name:'RSM SG Risk Advisory Pte Ltd',          contact:'Kendrick Choo',    email:'kendrickchooxh@rsmsingapore.sg',         phone:'9186 0900' },
  { rank:3,  name:'Contfinity Pte Ltd',                    contact:'Chan Kai Chung Alex', email:'alex.chan@contfinity.com',            phone:'9062 3231' },
  { rank:4,  name:'ATET Pte Ltd',                          contact:'Daniel Goh',       email:'daniel@atetsecurity.com',               phone:'9832 3308' },
  { rank:5,  name:'Momentum Z Pte Ltd',                    contact:'Shane Chiang',     email:'shane@mzt.one',                         phone:'9681 2888' },
  { rank:6,  name:'Nucleo Consulting Pte Ltd',             contact:'Sandra Yeow',      email:'sales@nucleoconsulting.com',            phone:'6911 0533' },
  { rank:7,  name:'Genesis Networks Pte Ltd',              contact:'James Tan',        email:'yongsiang.tan@gen-net.com.sg',          phone:'9684 0706' },
  { rank:8,  name:'Evvo Labs Pte Ltd',                     contact:'Vince Chew',       email:'vince.chew@evvolabs.com',               phone:'9668 6003' },
  { rank:9,  name:'Acuutech Pte Ltd',                      contact:'Hitan Mehta',      email:'cisoaas@acuutech.com',                  phone:'6978 6089' },
  { rank:10, name:'Nestor Consulting Pte Ltd',             contact:'Vineet Sinha',     email:'vineet.sinha@nestor.sg',                phone:'8661 9550' },
  { rank:11, name:'Imagenz Pte Ltd',                       contact:'Ang Soon Huat',    email:'ash@imagenz.net',                       phone:'9108 7809' },
  { rank:12, name:'Insyghts Security Pte Ltd',             contact:'Ng Ngee Hau',      email:'alex.ng@insyghts.com.sg',              phone:'8749 4825' },
  { rank:13, name:'Sin-Yun Pte Ltd',                       contact:'Luke Ku',          email:'luke@sinyun.sg',                        phone:'9025 1966' },
  { rank:14, name:'Rayn Secure Pte Ltd',                   contact:'Richard Pereira',  email:'richard.pereira@raynsecure.com',        phone:'9633 2806' },
  { rank:15, name:'Greenwich Management Consultancy Pte Ltd', contact:'Michelle Chew', email:'michelle@greenwich.com.sg',             phone:'9876 6828' },
  { rank:16, name:'Sekuro Operations Pte Ltd',             contact:'Belinda Liau',     email:'sgsales@sekuro.io',                     phone:'9190 7231' },
  { rank:17, name:'softScheck Singapore Pte Ltd',          contact:'Tsai Chern Haw',   email:'chernhaw.tsai@softscheck-apac.com',     phone:'9831 6333' },
  { rank:18, name:'Viperlink Pte Ltd',                     contact:'Lee Kok Onn',      email:'kolee@viperlink.com.sg',                phone:'9742 7774' },
  { rank:19, name:'Jwrtee Pte Ltd',                        contact:'Goh Choon Hua',    email:'gohch@jwrtee.com',                      phone:'8755 5977' },
  { rank:20, name:'M1 Limited',                            contact:'Tan Ke Han',       email:'tankha@m1.com.sg',                      phone:'9114 0614' },
  { rank:21, name:'TRS Forensics Pte Ltd',                 contact:'Tan Swee Wan',     email:'tansweewan@trsforensics.com',           phone:'9755 7010' },
  { rank:22, name:'Acclime Risk Advisory Pte Ltd',         contact:'Chia Shu Siang',   email:'shusiang.chia@acclime.com',             phone:'6856 9908' },
  { rank:23, name:'PDataCare Consultancy Pte Ltd',         contact:'Gn Chiang Soon',   email:'chiangsoon@pdatacare.com',              phone:'9616 8660' },
  { rank:24, name:'Nex CorporateIT Pte Ltd',               contact:'Max Goh',          email:'max.goh@nexcorporateit.com',            phone:'9139 9768' },
  { rank:25, name:'NY Risk Consulting Pte Ltd',            contact:'Gary Ng',          email:'garyng@nyrisk.sg',                      phone:'9679 1267' },
  { rank:26, name:'Lloyd McGill Pte Ltd',                  contact:'Jimmy Soon',       email:'jimmy.soon@lloydmcgill.com',            phone:'9631 1958' },
  { rank:27, name:'KPMG Services Pte Ltd',                 contact:'Eddie Toh',        email:'eddietoh@kpmg.com.sg',                  phone:'8112 0981' },
  { rank:28, name:'NTC Integration Pte Ltd',               contact:'Wilson Ng',        email:'wilson@ntc.com.sg',                     phone:'9455 6192' },
];

// ─── 9 Cyber Essentials Measures ─────────────────────────────────────────────
const MEASURES = [
  { id:'people',    label:'People & Training',     icon:'👥', color:'#6366f1', natAvg:44,
    desc:"Staff awareness, training, and human-layer defences — social engineering is the #2 top cybersecurity incident in Singapore organisations (CSA's Cybersecurity Health Report 2023)" },
  { id:'assets',    label:'Asset Management',      icon:'📦', color:'#0891b2', natAvg:57,
    desc:'Knowing and controlling your hardware, software, and data assets' },
  { id:'secure',    label:'Secure Configuration',  icon:'🔒', color:'#7c3aed', natAvg:51,
    desc:'Hardening systems and removing unnecessary features' },
  { id:'patch',     label:'Patch Management',      icon:'🔄', color:'#059669', natAvg:63,
    desc:'Keeping software and firmware up to date' },
  { id:'access',    label:'Access Control',        icon:'🗝️', color:'#d97706', natAvg:54,
    desc:'Controlling who can access systems, data, and admin rights' },
  { id:'malware',   label:'Malware Protection',    icon:'🛡️', color:'#dc2626', natAvg:68,
    desc:'Defending against malicious software across all endpoints' },
  { id:'network',   label:'Network Security',      icon:'🌐', color:'#0e7490', natAvg:48,
    desc:'Firewalls, segmentation, and securing network traffic' },
  { id:'data',      label:'Data Protection',       icon:'💾', color:'#7c3aed', natAvg:52,
    desc:'Backup, encryption, and data lifecycle management' },
  { id:'incident',  label:'Incident Response',     icon:'🚨', color:'#be123c', natAvg:40,
    desc:'Detecting, reporting, and recovering from cyber incidents' },
];

// ─── Assessment Questions (3 per measure) ────────────────────────────────────
const QUESTIONS: Record<string, { q: string; hint: string }[]> = {
  people: [
    { q:'Do all staff complete cybersecurity awareness training at least once a year?', hint:'Covers phishing, password hygiene, social engineering, and safe browsing.' },
    { q:'Do employees know how to recognise and report suspicious emails or links?', hint:'There is a clear reporting channel (e.g. helpdesk, email alias) they actively use.' },
    { q:'Are new employees given security briefings before accessing company systems?', hint:'Onboarding includes acceptable-use policy sign-off and security responsibilities.' },
  ],
  assets: [
    { q:'Do you maintain an up-to-date inventory of all devices (laptops, phones, servers)?', hint:'Includes personally-owned devices that access company data.' },
    { q:'Do you track all software applications and licences in use across the organisation?', hint:'Unauthorised or shadow-IT applications are identified and reviewed.' },
    { q:'Do you know where all sensitive/personal data is stored and who has access to it?', hint:'Data mapping or a simple register exists.' },
  ],
  secure: [
    { q:'Are default passwords changed on all devices, routers, and systems before deployment?', hint:'No device uses vendor default credentials in production.' },
    { q:'Are unnecessary services, ports, and applications disabled or removed?', hint:'Systems follow a hardening checklist or benchmark (e.g. CIS).' },
    { q:'Do you review and update security configurations at least annually?', hint:'Configuration drift is caught through periodic reviews or automated scanning.' },
  ],
  patch: [
    { q:'Are critical security patches applied to operating systems within 14 days of release?', hint:'Patch windows are defined and monitored.' },
    { q:'Are third-party applications (browsers, Office, Adobe, etc.) kept up to date?', hint:'Auto-update is enabled or a patch management tool is used.' },
    { q:'Are end-of-life or unsupported software/hardware tracked and replaced promptly?', hint:'A list of EOL assets exists and a migration plan is in place.' },
  ],
  access: [
    { q:'Is multi-factor authentication (MFA) enabled for all remote access and email accounts?', hint:'Includes VPN, cloud email, Microsoft 365, Google Workspace, etc.' },
    { q:'Do employees only have access to the systems and data needed for their role (least privilege)?', hint:'Admin rights are not given by default; they are reviewed regularly.' },
    { q:'Are account access reviews conducted when staff change roles or leave the organisation?', hint:'Departing employees have access revoked on or before their last day.' },
  ],
  malware: [
    { q:'Is endpoint protection (antivirus/EDR) installed and actively updated on all devices?', hint:'Covers laptops, desktops, and servers — not just some of them.' },
    { q:'Are removable media (USB drives) controlled or restricted?', hint:'Policy or technical controls prevent unauthorised USB use.' },
    { q:'Do you scan email attachments and downloads for malware before they reach users?', hint:'Gateway-level scanning or cloud email filtering is in place.' },
  ],
  network: [
    { q:'Is a firewall in place between the internet and your internal network?', hint:'Includes cloud environments — security groups / ACLs count.' },
    { q:'Is your Wi-Fi network secured with WPA2 or WPA3 and a strong passphrase?', hint:'Guest Wi-Fi is separated from the corporate network.' },
    { q:'Do you monitor network traffic for unusual or suspicious activity?', hint:'Logs are collected; alerts exist for anomalous connections or data volumes.' },
  ],
  data: [
    { q:'Are critical business data and systems backed up regularly (at least daily)?', hint:'Backups are automated and include all critical data.' },
    { q:'Are backups stored offline or in a separate environment (e.g. cloud, offsite)?', hint:'Ransomware cannot reach and encrypt the backup copies.' },
    { q:'Are backup restores tested at least once a year?', hint:'A restore drill has confirmed data can actually be recovered.' },
  ],
  incident: [
    { q:'Does your organisation have a documented incident response plan?', hint:'Contacts, escalation steps, and communication templates exist in writing.' },
    { q:'Do employees know who to contact and what to do if a cyber incident occurs?', hint:'There is a defined first-responder process and it has been communicated to staff.' },
    { q:'Have you tested or rehearsed your incident response plan in the past 12 months?', hint:'A tabletop exercise, drill, or simulation has been conducted.' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}

function pickProviders(employees: string, seed: string) {
  const rand = seededRandom(seed);
  // Larger orgs → prefer higher-ranked providers
  const pool = employees === '200+' ? CISO_PROVIDERS.slice(0, 10)
             : employees === '50-199' ? CISO_PROVIDERS.slice(0, 18)
             : CISO_PROVIDERS;
  const shuffled = [...pool].sort(() => rand() - 0.5);
  return shuffled.slice(0, 3);
}

function scoreColor(pct: number) {
  if (pct >= 70) return '#16a34a';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
}
function scoreLabel(pct: number) {
  if (pct >= 80) return 'Strong';
  if (pct >= 60) return 'Progressing';
  if (pct >= 40) return 'Developing';
  return 'At Risk';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HealthCheckPage() {
  const [step, setStep]     = useState<Step>('profile');
  const [profile, setProfile] = useState<Profile>({
    sector:'', years:'', employees:'', turnover:'',
    uen:'', companyName:'', psgRef:'',
  });
  const [answers, setAnswers] = useState<Record<string, Ans[]>>({});
  const [errors, setErrors]   = useState<string[]>([]);

  // Initialise blank answers for all questions
  function initAnswers() {
    const a: Record<string, Ans[]> = {};
    MEASURES.forEach(m => { a[m.id] = QUESTIONS[m.id].map(() => null); });
    setAnswers(a);
  }

  function validateProfile() {
    const e: string[] = [];
    if (!profile.sector)    e.push('Sector is required.');
    if (!profile.years)     e.push('Years in operation is required.');
    if (!profile.employees) e.push('Number of employees is required.');
    if (!profile.turnover)  e.push('Annual sales turnover is required.');
    setErrors(e);
    return e.length === 0;
  }

  function handleStartAssessment() {
    if (!validateProfile()) return;
    initAnswers();
    setStep('questions');
    window.scrollTo(0, 0);
  }

  function setAns(measureId: string, qIdx: number, val: Ans) {
    setAnswers(prev => {
      const copy = { ...prev };
      copy[measureId] = [...(copy[measureId] || [])];
      copy[measureId][qIdx] = val;
      return copy;
    });
  }

  const totalAnswered = useMemo(() => {
    return MEASURES.reduce((sum, m) => sum + (answers[m.id]?.filter(Boolean).length || 0), 0);
  }, [answers]);
  const totalQuestions = MEASURES.length * 3;

  function calcResults() {
    const perMeasure: Record<string, number> = {};
    let totalPoints = 0, maxPoints = 0;
    MEASURES.forEach(m => {
      const ans = answers[m.id] || [];
      const pts = ans.reduce((s, a) => s + (a === 'yes' ? 2 : a === 'partial' ? 1 : 0), 0);
      const max = QUESTIONS[m.id].length * 2;
      perMeasure[m.id] = Math.round((pts / max) * 100);
      totalPoints += pts;
      maxPoints   += max;
    });
    const overall = Math.round((totalPoints / maxPoints) * 100);
    return { overall, perMeasure };
  }

  function handleViewResults() {
    setStep('results');
    window.scrollTo(0, 0);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const base: React.CSSProperties = {
    minHeight:'100vh', background:'#f8fafc',
    color:'#0f172a', fontFamily:"'Segoe UI', system-ui, sans-serif",
  };

  const inputSt: React.CSSProperties = {
    width:'100%', padding:'0.7rem 0.875rem', borderRadius:'0.5rem',
    border:'1.5px solid #e2e8f0', background:'#fff', color:'#0f172a',
    fontSize:'0.95rem', outline:'none', boxSizing:'border-box',
    appearance:'none' as React.CSSProperties['appearance'],
  };
  const labelSt: React.CSSProperties = {
    display:'block', fontWeight:700, fontSize:'0.82rem',
    color:'#475569', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'0.35rem',
  };
  const cardSt: React.CSSProperties = {
    background:'#fff', borderRadius:'1rem', border:'1px solid #e2e8f0',
    padding:'1.5rem', boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
  };

  // ── STEP: PROFILE ─────────────────────────────────────────────────────────
  if (step === 'profile') {
    return (
      <div style={base}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1e1b4b,#3730a3)', padding:'2rem 1.5rem 1.5rem', color:'#fff' }}>
          <div style={{ maxWidth:780, margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
              <a href="/game" style={{ color:'#a5b4fc', fontSize:'0.85rem', textDecoration:'none' }}>← Back to Game</a>
            </div>
            <h1 style={{ fontSize:'clamp(1.6rem,4vw,2.4rem)', fontWeight:900, margin:'0 0 0.4rem', lineHeight:1.2 }}>
              🏥 Cyber Health Check Tool
            </h1>
            <p style={{ color:'#a5b4fc', margin:0, fontSize:'1rem' }}>
              Based on CSA Singapore&apos;s Cyber Essentials framework · Assessment takes ~5 minutes
            </p>
            {/* Progress bar */}
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'1.25rem' }}>
              {['Company Profile','Assessment','Your Results'].map((l,i) => (
                <div key={l} style={{ flex:1, textAlign:'center' }}>
                  <div style={{ height:4, borderRadius:99, background: i===0 ? '#818cf8' : '#ffffff30', marginBottom:'0.3rem' }} />
                  <span style={{ fontSize:'0.75rem', color: i===0 ? '#c7d2fe' : '#ffffff50', fontWeight:i===0?700:400 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth:780, margin:'0 auto', padding:'2rem 1rem' }}>
          {/* Mandatory fields */}
          <div style={cardSt}>
            <h2 style={{ margin:'0 0 0.25rem', fontSize:'1.15rem' }}>Company Profile</h2>
            <p style={{ color:'#64748b', fontSize:'0.88rem', margin:'0 0 1.25rem' }}>
              Fields marked <span style={{ color:'#dc2626' }}>*</span> are required to generate your assessment.
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
              <div>
                <label style={labelSt}>Sector <span style={{ color:'#dc2626' }}>*</span></label>
                <select value={profile.sector} onChange={e=>setProfile(p=>({...p,sector:e.target.value}))} style={inputSt}>
                  <option value="">Select your sector…</option>
                  {['Healthcare','Finance & Banking','Retail & E-Commerce','Manufacturing','Professional Services',
                    'Logistics & Transport','Education','Information & Communications','Construction & Real Estate',
                    'Food & Beverage','Government / Public Sector','Non-Profit','Other'].map(s=>(
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelSt}>Years in Operation <span style={{ color:'#dc2626' }}>*</span></label>
                <select value={profile.years} onChange={e=>setProfile(p=>({...p,years:e.target.value}))} style={inputSt}>
                  <option value="">Select…</option>
                  {['Less than 1 year','1 – 3 years','3 – 5 years','5 – 10 years','More than 10 years'].map(y=>(
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelSt}>Number of Employees <span style={{ color:'#dc2626' }}>*</span></label>
                <select value={profile.employees} onChange={e=>setProfile(p=>({...p,employees:e.target.value}))} style={inputSt}>
                  <option value="">Select…</option>
                  {['1 – 9','10 – 49','50 – 199','200 or more'].map(o=>(
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelSt}>Annual Sales Turnover (SGD) <span style={{ color:'#dc2626' }}>*</span></label>
                <select value={profile.turnover} onChange={e=>setProfile(p=>({...p,turnover:e.target.value}))} style={inputSt}>
                  <option value="">Select…</option>
                  {['Less than $1M','$1M – $5M','$5M – $10M','$10M – $50M','More than $50M'].map(t=>(
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Validation errors */}
            {errors.length > 0 && (
              <div style={{ marginTop:'1rem', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'0.5rem', padding:'0.75rem 1rem' }}>
                {errors.map(e=><p key={e} style={{ color:'#dc2626', margin:'0.15rem 0', fontSize:'0.88rem' }}>⚠ {e}</p>)}
              </div>
            )}
          </div>

          {/* Optional fields */}
          <div style={{ ...cardSt, marginTop:'1rem' }}>
            <h2 style={{ margin:'0 0 0.25rem', fontSize:'1.1rem' }}>Optional Details</h2>
            <p style={{ color:'#64748b', fontSize:'0.88rem', margin:'0 0 1.25rem' }}>
              Not required — helps us personalise your report.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'1rem' }}>
              {[
                { key:'companyName', label:'Company Name' },
                { key:'uen',         label:'UEN (Unique Entity Number)' },
                { key:'psgRef',      label:'PSG Reference ID' },
              ].map(f=>(
                <div key={f.key}>
                  <label style={labelSt}>{f.label}</label>
                  <input value={profile[f.key as keyof Profile]}
                    onChange={e=>setProfile(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.key==='uen'?'e.g. 202012345A':f.key==='psgRef'?'e.g. PSG-2024-XXXXX':''}
                    style={inputSt} />
                </div>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'0.75rem', padding:'1rem 1.25rem', marginTop:'1rem', fontSize:'0.88rem', color:'#1e40af' }}>
            <strong>What happens next:</strong> Based on your profile, you&apos;ll answer ~27 questions across 9 Cyber Essentials measures. Your responses generate a personalised health score out of 100 with a breakdown vs the national SME average.
          </div>

          <button onClick={handleStartAssessment}
            style={{ marginTop:'1.5rem', width:'100%', padding:'1rem', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', borderRadius:'0.875rem', fontSize:'1.1rem', fontWeight:700, cursor:'pointer' }}>
            Start In-Depth Assessment →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: QUESTIONS ───────────────────────────────────────────────────────
  if (step === 'questions') {
    const pct = Math.round((totalAnswered / totalQuestions) * 100);
    return (
      <div style={base}>
        {/* Sticky header */}
        <div style={{ position:'sticky', top:0, zIndex:50, background:'linear-gradient(135deg,#1e1b4b,#3730a3)', padding:'0.875rem 1.5rem', color:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
          <div style={{ maxWidth:780, margin:'0 auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.4rem' }}>
              <span style={{ fontWeight:700, fontSize:'0.95rem' }}>🏥 Cyber Health Check</span>
              <span style={{ fontSize:'0.82rem', color:'#a5b4fc' }}>{totalAnswered} / {totalQuestions} answered</span>
            </div>
            <div style={{ height:6, background:'#ffffff25', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:'#818cf8', borderRadius:99, transition:'width 0.3s' }} />
            </div>
          </div>
        </div>

        <div style={{ maxWidth:780, margin:'0 auto', padding:'1.5rem 1rem 3rem' }}>
          <p style={{ color:'#64748b', fontSize:'0.88rem', marginBottom:'1.5rem' }}>
            For each practice below, select <strong>Yes</strong> (fully in place), <strong>Partial</strong> (partly in place), or <strong>No</strong> (not yet done).
          </p>

          {MEASURES.map(m => (
            <div key={m.id} style={{ ...cardSt, marginBottom:'1.25rem' }}>
              {/* Measure header */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.25rem' }}>
                <span style={{ fontSize:'1.6rem', flexShrink:0 }}>{m.icon}</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:'1.05rem', color:m.color }}>{m.label}</div>
                  <div style={{ fontSize:'0.8rem', color:'#64748b' }}>{m.desc}</div>
                </div>
              </div>
              <div style={{ height:1, background:'#e2e8f0', margin:'0.875rem 0' }} />

              {QUESTIONS[m.id].map((q, qi) => {
                const ans = answers[m.id]?.[qi] ?? null;
                return (
                  <div key={qi} style={{ marginBottom: qi < 2 ? '1.25rem' : 0 }}>
                    <p style={{ margin:'0 0 0.5rem', fontSize:'0.92rem', fontWeight:600, color:'#1e293b' }}>{qi+1}. {q.q}</p>
                    <p style={{ margin:'0 0 0.6rem', fontSize:'0.78rem', color:'#94a3b8' }}>💡 {q.hint}</p>
                    <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                      {(['yes','partial','no'] as const).map(opt => {
                        const cfg = {
                          yes:     { label:'✅ Yes',     bg:'#f0fdf4', border:'#86efac', text:'#15803d', sel:'#16a34a' },
                          partial: { label:'🔶 Partial', bg:'#fffbeb', border:'#fcd34d', text:'#b45309', sel:'#d97706' },
                          no:      { label:'❌ No',      bg:'#fef2f2', border:'#fca5a5', text:'#b91c1c', sel:'#dc2626' },
                        }[opt];
                        const selected = ans === opt;
                        return (
                          <button key={opt} onClick={() => setAns(m.id, qi, opt)}
                            style={{ padding:'0.45rem 1.1rem', borderRadius:'2rem', border:`2px solid ${selected ? cfg.sel : cfg.border}`, background: selected ? cfg.sel : cfg.bg, color: selected ? '#fff' : cfg.text, fontWeight: selected ? 700 : 600, fontSize:'0.85rem', cursor:'pointer', transition:'all 0.1s' }}>
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div style={{ position:'sticky', bottom:'1rem' }}>
            <button onClick={handleViewResults} disabled={totalAnswered < totalQuestions}
              style={{ width:'100%', padding:'1rem', background: totalAnswered === totalQuestions ? 'linear-gradient(135deg,#16a34a,#059669)' : '#94a3b8', color:'#fff', border:'none', borderRadius:'0.875rem', fontSize:'1.1rem', fontWeight:700, cursor: totalAnswered === totalQuestions ? 'pointer' : 'not-allowed', boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>
              {totalAnswered < totalQuestions ? `Answer all questions to continue (${totalQuestions - totalAnswered} remaining)` : '📊 View My Health Score →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: RESULTS ─────────────────────────────────────────────────────────
  const { overall, perMeasure } = calcResults();
  const providers = pickProviders(profile.employees, profile.companyName + profile.sector);

  return (
    <div style={base}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#3730a3)', padding:'2rem 1.5rem 1.5rem', color:'#fff' }}>
        <div style={{ maxWidth:820, margin:'0 auto' }}>
          <h1 style={{ fontSize:'clamp(1.4rem,4vw,2rem)', fontWeight:900, margin:'0 0 0.3rem' }}>
            📊 Your Cyber Essentials Health Score
          </h1>
          <p style={{ color:'#a5b4fc', margin:0, fontSize:'0.95rem' }}>
            {profile.companyName ? `${profile.companyName} · ` : ''}{profile.sector} · {profile.employees} employees
          </p>
          {/* Step bar — step 3 active */}
          <div style={{ display:'flex', gap:'0.5rem', marginTop:'1.25rem' }}>
            {['Company Profile','Assessment','Your Results'].map((l,i)=>(
              <div key={l} style={{ flex:1, textAlign:'center' }}>
                <div style={{ height:4, borderRadius:99, background: i===2 ? '#818cf8' : '#22c55e', marginBottom:'0.3rem' }} />
                <span style={{ fontSize:'0.75rem', color: i===2 ? '#c7d2fe' : '#86efac', fontWeight:700 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:820, margin:'0 auto', padding:'2rem 1rem 4rem' }}>

        {/* ── Overall Score ── */}
        <div style={{ ...cardSt, textAlign:'center', marginBottom:'1.25rem' }}>
          <p style={{ color:'#64748b', margin:'0 0 0.5rem', fontSize:'0.88rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:700 }}>Overall Cyber Essentials Health Score</p>
          <div style={{ fontSize:'clamp(4rem,12vw,6rem)', fontWeight:900, color:scoreColor(overall), lineHeight:1 }}>
            {overall}
          </div>
          <div style={{ fontSize:'1.1rem', color:scoreColor(overall), fontWeight:700, marginBottom:'0.5rem' }}>{scoreLabel(overall)} · out of 100</div>
          {/* Score bar */}
          <div style={{ height:16, background:'#e2e8f0', borderRadius:99, overflow:'hidden', maxWidth:500, margin:'0.75rem auto' }}>
            <div style={{ height:'100%', width:`${overall}%`, background:scoreColor(overall), borderRadius:99, transition:'width 1s' }} />
          </div>
          <p style={{ color:'#64748b', fontSize:'0.85rem', margin:0 }}>
            Singapore SME National Average: <strong>~53 / 100</strong>
            {overall >= 53
              ? <span style={{ color:'#16a34a', fontWeight:700 }}> — you are above the national average 🎉</span>
              : <span style={{ color:'#d97706', fontWeight:700 }}> — there is room to grow</span>}
          </p>
        </div>

        {/* ── Score Breakdown by Measure ── */}
        <div style={{ ...cardSt, marginBottom:'1.25rem' }}>
          <h2 style={{ margin:'0 0 1.25rem', fontSize:'1.1rem' }}>📈 Score Breakdown vs National Average</h2>
          {MEASURES.map(m => {
            const yours = perMeasure[m.id];
            const natW  = m.natAvg;
            return (
              <div key={m.id} style={{ marginBottom:'1.1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.25rem' }}>
                  <span style={{ fontWeight:700, fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <span>{m.icon}</span> {m.label}
                  </span>
                  <span style={{ fontSize:'0.82rem', color:'#64748b' }}>
                    You: <strong style={{ color:scoreColor(yours) }}>{yours}%</strong>
                    &nbsp;·&nbsp;Avg: <strong>{natW}%</strong>
                  </span>
                </div>
                {/* Your score bar */}
                <div style={{ position:'relative', height:12, background:'#e2e8f0', borderRadius:99, overflow:'visible', marginBottom:'0.2rem' }}>
                  <div style={{ height:'100%', width:`${yours}%`, background:scoreColor(yours), borderRadius:99 }} />
                  {/* National average marker */}
                  <div style={{ position:'absolute', top:'-3px', left:`${natW}%`, width:2, height:18, background:'#64748b', borderRadius:1 }} title={`National avg: ${natW}%`} />
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <span style={{ fontSize:'0.7rem', color:'#94a3b8' }}>▼ national avg ({natW}%)</span>
                </div>
              </div>
            );
          })}
          <p style={{ color:'#94a3b8', fontSize:'0.75rem', marginTop:'0.5rem', borderTop:'1px solid #e2e8f0', paddingTop:'0.75rem' }}>
            ▼ marker = Singapore SME national average. Source: CSA Singapore Cyber Landscape reports.
          </p>
        </div>

        {/* ── Recommended Actions ── */}
        <div style={{ ...cardSt, marginBottom:'1.25rem' }}>
          <h2 style={{ margin:'0 0 1rem', fontSize:'1.1rem' }}>🎯 Priority Recommendations</h2>
          <div style={{ display:'grid', gap:'0.75rem' }}>
            {MEASURES
              .map(m => ({ ...m, score: perMeasure[m.id] }))
              .sort((a,b) => a.score - b.score)
              .slice(0,3)
              .map(m => (
                <div key={m.id} style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'0.75rem', padding:'0.875rem 1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1.5rem', flexShrink:0 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontWeight:800, fontSize:'0.9rem', color:m.color }}>{m.label} — <span style={{ color:scoreColor(m.score) }}>{m.score}%</span></div>
                    <div style={{ color:'#64748b', fontSize:'0.82rem', marginTop:'0.2rem' }}>
                      {m.id === 'incident'  && 'Document an incident response plan and run at least one annual tabletop exercise.'}
                      {m.id === 'people'    && "Launch a mandatory annual security awareness programme — social engineering is the #2 top cybersecurity incident in Singapore organisations (CSA's Cybersecurity Health Report 2023). Even 1–2 hours of training significantly reduces phishing and social engineering risk."}
                      {m.id === 'network'   && 'Review firewall rules, enable WPA3 on Wi-Fi, and set up network activity logging.'}
                      {m.id === 'secure'    && 'Remove default credentials, disable unused services, and follow a hardening checklist.'}
                      {m.id === 'access'    && 'Enable MFA on all email and remote access accounts and enforce least-privilege roles.'}
                      {m.id === 'data'      && 'Automate daily backups and store copies offline or in a separate cloud environment.'}
                      {m.id === 'assets'    && 'Build a simple device and software inventory — a spreadsheet is a good starting point.'}
                      {m.id === 'patch'     && 'Enable auto-updates on all endpoints and track end-of-life software for replacement.'}
                      {m.id === 'malware'   && 'Deploy endpoint protection (EDR) on all devices and enforce USB restriction policies.'}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ── CISO-as-a-Service Suggestions ── */}
        <div style={{ ...cardSt, marginBottom:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'0.5rem', marginBottom:'1rem' }}>
            <div>
              <h2 style={{ margin:'0 0 0.25rem', fontSize:'1.1rem' }}>👔 Suggested CISO-as-a-Service Providers</h2>
              <p style={{ color:'#64748b', fontSize:'0.82rem', margin:0 }}>
                CSA-recognised providers matched to your organisation ({profile.employees} employees). Funded support available.
              </p>
            </div>
            <a href="https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-certification-for-organisations/ciso-as-a-service-to-develop-cybersecurity-health-plan/"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize:'0.8rem', color:'#4f46e5', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
              View full CSA listing →
            </a>
          </div>
          <div style={{ display:'grid', gap:'0.875rem' }}>
            {providers.map(p => (
              <div key={p.rank} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'0.875rem', padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.5rem' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#1e293b' }}>{p.name}</div>
                  <div style={{ color:'#64748b', fontSize:'0.82rem', marginTop:'0.15rem' }}>Contact: {p.contact}</div>
                </div>
                <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexShrink:0 }}>
                  <a href={`mailto:${p.email}`} style={{ color:'#4f46e5', fontSize:'0.83rem', fontWeight:700, textDecoration:'none' }}>✉️ {p.email}</a>
                  <span style={{ color:'#64748b', fontSize:'0.83rem' }}>📞 {p.phone}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'0.875rem', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'0.5rem', padding:'0.75rem 1rem', fontSize:'0.82rem', color:'#1e40af' }}>
            💡 The CSA CISOaaS scheme is co-funded — eligible SMEs receive up to 70% funding support. Contact a provider above to get started.
          </div>
        </div>

        {/* ── Next Steps ── */}
        <div style={{ display:'grid', gap:'0.875rem', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', marginBottom:'1.25rem' }}>
          {[
            { icon:'🛡️', title:'Cyber Essentials Mark', desc:'Get certified to show customers you take security seriously.', url:'https://go.gov.sg/cyber-essentials', color:'#4f46e5' },
            { icon:'💻', title:'Readiness Scan (Device)', desc:'Run an automated device security scan right now.', url:'https://cetool-mvp.vercel.app/', color:'#0891b2' },
            { icon:'📋', title:'Self-Assessment Checklist', desc:'Download the free Cyber Essentials self-assessment Excel.', url:'https://isomer-user-content.by.gov.sg/36/f9481424-2c5a-4e02-a113-0f18ed7cd4ef/cyber-essentials-self-assessment-v202504.xlsx', color:'#16a34a' },
          ].map(n => (
            <a key={n.title} href={n.url} target="_blank" rel="noopener noreferrer"
              style={{ background:'#fff', border:`2px solid ${n.color}30`, borderRadius:'1rem', padding:'1.25rem', textDecoration:'none', color:'#1e293b', display:'block', transition:'box-shadow 0.15s' }}>
              <div style={{ fontSize:'1.75rem', marginBottom:'0.4rem' }}>{n.icon}</div>
              <div style={{ fontWeight:800, fontSize:'0.95rem', color:n.color }}>{n.title}</div>
              <div style={{ color:'#64748b', fontSize:'0.82rem', marginTop:'0.25rem' }}>{n.desc}</div>
            </a>
          ))}
        </div>

        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
          <button onClick={() => { setStep('profile'); setErrors([]); window.scrollTo(0,0); }}
            style={{ padding:'0.75rem 1.5rem', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'0.75rem', color:'#475569', fontWeight:700, cursor:'pointer', fontSize:'0.95rem' }}>
            ← Start Over
          </button>
          <a href="/game" style={{ padding:'0.75rem 1.5rem', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:'0.75rem', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'0.95rem', textDecoration:'none' }}>
            🎮 Back to Game
          </a>
          <a href="/game/resources" style={{ padding:'0.75rem 1.5rem', background:'#0f172a', border:'none', borderRadius:'0.75rem', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'0.95rem', textDecoration:'none' }}>
            🛡️ CSA Resources
          </a>
        </div>
      </div>
    </div>
  );
}
