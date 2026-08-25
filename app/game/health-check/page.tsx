'use client';

import { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'profile' | 'questions' | 'results';
interface Profile {
  sector: string; years: string; employees: string; turnover: string;
  uen: string; companyName: string; psgRef: string;
}

// ─── CISO-as-a-Service Providers (CSA listing, ranked by track record) ───────
const CISO_PROVIDERS = [
  { rank:1,  name:'CyberSafe Pte Ltd',                        contact:'Dave Gurbani',        email:'dave@cybersafe.sg',                     phone:'8725 9789' },
  { rank:2,  name:'RSM SG Risk Advisory Pte Ltd',             contact:'Kendrick Choo',        email:'kendrickchooxh@rsmsingapore.sg',         phone:'9186 0900' },
  { rank:3,  name:'Contfinity Pte Ltd',                       contact:'Chan Kai Chung Alex',  email:'alex.chan@contfinity.com',               phone:'9062 3231' },
  { rank:4,  name:'ATET Pte Ltd',                             contact:'Daniel Goh',           email:'daniel@atetsecurity.com',               phone:'9832 3308' },
  { rank:5,  name:'Momentum Z Pte Ltd',                       contact:'Shane Chiang',         email:'shane@mzt.one',                         phone:'9681 2888' },
  { rank:6,  name:'Nucleo Consulting Pte Ltd',                contact:'Sandra Yeow',          email:'sales@nucleoconsulting.com',             phone:'6911 0533' },
  { rank:7,  name:'Genesis Networks Pte Ltd',                 contact:'James Tan',            email:'yongsiang.tan@gen-net.com.sg',           phone:'9684 0706' },
  { rank:8,  name:'Evvo Labs Pte Ltd',                        contact:'Vince Chew',           email:'vince.chew@evvolabs.com',               phone:'9668 6003' },
  { rank:9,  name:'Acuutech Pte Ltd',                         contact:'Hitan Mehta',          email:'cisoaas@acuutech.com',                  phone:'6978 6089' },
  { rank:10, name:'Nestor Consulting Pte Ltd',                contact:'Vineet Sinha',         email:'vineet.sinha@nestor.sg',                phone:'8661 9550' },
  { rank:11, name:'Imagenz Pte Ltd',                          contact:'Ang Soon Huat',        email:'ash@imagenz.net',                       phone:'9108 7809' },
  { rank:12, name:'Insyghts Security Pte Ltd',                contact:'Ng Ngee Hau',          email:'alex.ng@insyghts.com.sg',               phone:'8749 4825' },
  { rank:13, name:'Sin-Yun Pte Ltd',                          contact:'Luke Ku',              email:'luke@sinyun.sg',                        phone:'9025 1966' },
  { rank:14, name:'Rayn Secure Pte Ltd',                      contact:'Richard Pereira',      email:'richard.pereira@raynsecure.com',        phone:'9633 2806' },
  { rank:15, name:'Greenwich Management Consultancy Pte Ltd', contact:'Michelle Chew',        email:'michelle@greenwich.com.sg',             phone:'9876 6828' },
  { rank:16, name:'Sekuro Operations Pte Ltd',                contact:'Belinda Liau',         email:'sgsales@sekuro.io',                     phone:'9190 7231' },
  { rank:17, name:'softScheck Singapore Pte Ltd',             contact:'Tsai Chern Haw',       email:'chernhaw.tsai@softscheck-apac.com',     phone:'9831 6333' },
  { rank:18, name:'Viperlink Pte Ltd',                        contact:'Lee Kok Onn',          email:'kolee@viperlink.com.sg',                phone:'9742 7774' },
  { rank:19, name:'Jwrtee Pte Ltd',                           contact:'Goh Choon Hua',        email:'gohch@jwrtee.com',                      phone:'8755 5977' },
  { rank:20, name:'M1 Limited',                               contact:'Tan Ke Han',           email:'tankha@m1.com.sg',                      phone:'9114 0614' },
  { rank:21, name:'TRS Forensics Pte Ltd',                    contact:'Tan Swee Wan',         email:'tansweewan@trsforensics.com',           phone:'9755 7010' },
  { rank:22, name:'Acclime Risk Advisory Pte Ltd',            contact:'Chia Shu Siang',       email:'shusiang.chia@acclime.com',             phone:'6856 9908' },
  { rank:23, name:'PDataCare Consultancy Pte Ltd',            contact:'Gn Chiang Soon',       email:'chiangsoon@pdatacare.com',              phone:'9616 8660' },
  { rank:24, name:'Nex CorporateIT Pte Ltd',                  contact:'Max Goh',              email:'max.goh@nexcorporateit.com',            phone:'9139 9768' },
  { rank:25, name:'NY Risk Consulting Pte Ltd',               contact:'Gary Ng',              email:'garyng@nyrisk.sg',                      phone:'9679 1267' },

  { rank:27, name:'KPMG Services Pte Ltd',                    contact:'Eddie Toh',            email:'eddietoh@kpmg.com.sg',                  phone:'8112 0981' },
  { rank:28, name:'NTC Integration Pte Ltd',                  contact:'Wilson Ng',            email:'wilson@ntc.com.sg',                     phone:'9455 6192' },
];

// ─── 9 Measures with exact checkbox questions from CSA Excel ─────────────────
interface Measure {
  id: string; label: string; shortLabel: string; icon: string; color: string;
  group: string; natAvg: number;
  question: string;
  options: string[];  // last item is always "None of the above"
}

const MEASURES: Measure[] = [
  {
    id: 'people', label: 'People', shortLabel: 'People', icon: '👥', color: '#6366f1',
    group: 'Assets', natAvg: 44,
    question: 'Q1: Has your organisation implemented the following measures to equip your employees to be the first line of defence?',
    options: [
      'Cybersecurity awareness and training for all employees',
      'Cybersecurity practices and guidelines for daily operations',
      'None of the above',
    ],
  },
  {
    id: 'hardware', label: 'Hardware and Software', shortLabel: 'Hardware & SW', icon: '💻', color: '#0891b2',
    group: 'Assets', natAvg: 51,
    question: 'Q2: Has your organisation implemented the following measures to know what hardware and software your organisation has and protect them?',
    options: [
      'Up-to-date inventory of all hardware and software including those on cloud instances (e.g. software and operating system used)',
      'Unauthorised and End of Service/Life (EOS/EOL) assets are replaced; and if EOS/EOL assets are in use before replacement, they are assessed and monitored for risks, and approved by senior management',
      'Process to on-board new hardware and software into the organisation',
      'Date of authorisation of the hardware and software are recorded in the inventory list, and those without approval dates are removed',
      'All confidential information is deleted before any hardware asset is disposed',
      'None of the above',
    ],
  },
  {
    id: 'data', label: 'Data', shortLabel: 'Data', icon: '🗄️', color: '#7c3aed',
    group: 'Assets', natAvg: 48,
    question: 'Q3: Has your organisation implemented the following measures to know what data your organisation has and secure them?',
    options: [
      'Up-to-date inventory of business-critical data',
      'Process to protect your organisation business-critical data, e.g. password protection of document, encryption of personal data stored',
      'Prevent employees from leaking confidential/sensitive data outside the organisation e.g. disabling USB ports',
      'Paper-based/hard copy media containing confidential/sensitive data are securely shredded',
      'None of the above',
    ],
  },
  {
    id: 'malware', label: 'Virus and Malware Protection', shortLabel: 'Virus & Malware', icon: '🛡️', color: '#dc2626',
    group: 'Secure/Protect', natAvg: 63,
    question: 'Q4: Has your organisation implemented the following measures to protect systems and devices from malicious software like viruses and malwares?',
    options: [
      'Anti-malware solutions are installed and used in endpoints (i.e. laptop, mobile devices, servers)',
      'Virus and malware scans are performed to detect possible cyberattacks',
      'Anti-malware solutions are updated automatically to detect new malware (e.g. signature files)',
      'Anti-malware solutions are configured to automatically scan the files upon access, including files downloaded from internet/emails/USB drive',
      'Firewalls are deployed to protect networks, systems and endpoints, and network perimeter firewalls are configured to analyse and accept only authorised network traffic',
      'Employees use only authorised software from official or trusted sources',
      'Employees are aware of the use of trusted network connections for accessing organisation\'s data or business email, e.g. through corporate network or VPN',
      'Employees are aware of the need to report any suspicious email/attachment or cybersecurity incidents to the IT team/senior management immediately',
      'None of the above',
    ],
  },
  {
    id: 'access', label: 'Access Control', shortLabel: 'Access Control', icon: '🗝️', color: '#d97706',
    group: 'Secure/Protect', natAvg: 52,
    question: 'Q5: Has your organisation implemented the following measures to restrict access to your data and services?',
    options: [
      'Manage and maintain the inventory of accounts, including users, administrators, third parties and service accounts',
      'Approval process to grant and revoke access',
      'Employees can access only the information and systems required for their job roles',
      'Accounts that no longer require the access rights or have exceeded the requested date for access, as well as shared/duplicate/obsolete/invalid accounts are disabled or removed',
      'Administrator accounts are only accessed to perform administrative functions with approval from management',
      'Access for third parties or contractors are managed and restricted to only information/systems required for their job role, and removed when they no longer require the access',
      'Third parties or contractors working with sensitive information are required to sign an NDA (non-disclosure agreement)',
      'Physical access control is enforced to allow only authorised personnel to access the organisation\'s IT assets/environment',
      'All default passwords are changed and replaced with strong passphrases',
      'Accounts that have multiple failed login attempts are disabled/locked out',
      'Account passwords are changed in the event of any suspected compromise',
      'None of the above',
    ],
  },
  {
    id: 'secure', label: 'Secure Configuration', shortLabel: 'Secure Config', icon: '⚙️', color: '#059669',
    group: 'Secure/Protect', natAvg: 49,
    question: 'Q6: Has your organisation implemented the following measures on secure settings for all hardware and software assets?',
    options: [
      'Security configurations are enforced for all assets using industry recommendations and standards (e.g. CIS benchmarks)',
      'Default, weak or insecure configurations are avoided or upgraded, e.g. changing default password, using HTTPS instead of HTTP, WPA2/WPA3 instead of WEP',
      'Features, services or applications that are not in use are disabled or removed, e.g. file sharing services, FTP',
      'Features, such as auto-connect to open networks and auto-run of non-essential programs are disabled',
      'None of the above',
    ],
  },
  {
    id: 'updates', label: 'Software Updates', shortLabel: 'SW Updates', icon: '🔄', color: '#0e7490',
    group: 'Update', natAvg: 68,
    question: 'Q7: Has your organisation implemented the following measures on software update for systems and devices?',
    options: [
      'Critical or important updates for operating systems and applications (e.g. security patches) are prioritised and applied as soon as possible',
      'None of the above',
    ],
  },
  {
    id: 'backup', label: 'Backup', shortLabel: 'Backup', icon: '💾', color: '#16a34a',
    group: 'Backup', natAvg: 54,
    question: 'Q8: Has your organisation implemented the following measures to back up essential data and store them offline:',
    options: [
      'Business-critical systems and those containing essential business information (e.g. financial and business transactions) are identified and backed up regularly, including data stored in the cloud environment',
      'Backups are protected from unauthorised access',
      'Backups are stored separately (i.e. offline) from the operating environment',
      'Longer term backups (e.g. monthly backups) are stored offline securely at an alternative location',
      'None of the above',
    ],
  },
  {
    id: 'incident', label: 'Incident Response', shortLabel: 'Incident Response', icon: '🚨', color: '#be123c',
    group: 'Respond', natAvg: 38,
    question: 'Q9: Has your organisation put in place an incident response management to detect, respond to, and recover from cybersecurity incidents?',
    options: [
      'Up-to-date incident response plan that contains clear roles and responsibilities, procedures to detect/respond/recover from incidents, and communication plan and timeline to escalate and report to stakeholders (e.g. regulators, customers and management)',
      'Employees who have access to the organisation\'s IT assets/environment are aware of the incident response plan',
      'None of the above',
    ],
  },
];

// Groups for results display
const GROUPS = [
  { id:'Assets',        label:'Assets',         icon:'📦', measures:['people','hardware','data'] },
  { id:'Secure/Protect',label:'Secure / Protect',icon:'🔒', measures:['malware','access','secure'] },
  { id:'Update',        label:'Update',          icon:'🔄', measures:['updates'] },
  { id:'Backup',        label:'Backup',          icon:'💾', measures:['backup'] },
  { id:'Respond',       label:'Respond',         icon:'🚨', measures:['incident'] },
];

// ─── Scoring helpers ──────────────────────────────────────────────────────────
function measureScore(m: Measure, checked: Set<number>): number {
  const noneIdx = m.options.length - 1;
  if (checked.has(noneIdx) || checked.size === 0) return 0;
  const scored = [...checked].filter(i => i !== noneIdx).length;
  const total = m.options.length - 1; // exclude "None of the above"
  return Math.round((scored / total) * 100);
}

function overallScore(scores: Record<string, number>): number {
  const vals = MEASURES.map(m => scores[m.id] ?? 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function tier(score: number): { label: string; color: string; desc: string } {
  if (score >= 70) return { label: 'Cyber Champion', color: '#16a34a', desc: 'Your organisation has strong cybersecurity foundations. Keep maintaining and improving these practices.' };
  if (score >= 40) return { label: 'Cyber Intermediate', color: '#d97706', desc: 'You have made a good start on cybersecurity. There are still areas to improve to better protect your business.' };
  return { label: 'Cyber Starter', color: '#dc2626', desc: 'You have just started your cybersecurity journey. This puts your business at risk of cyber attacks. Explore our recommendations to better protect your business.' };
}

function scoreColor(pct: number) {
  if (pct >= 70) return '#16a34a';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}

function pickProviders(employees: string, seed: string) {
  const rand = seededRandom(seed || 'default');
  const pool = employees === '200 or more' ? CISO_PROVIDERS.slice(0, 10)
             : employees === '50 – 199'    ? CISO_PROVIDERS.slice(0, 18)
             : CISO_PROVIDERS;
  return [...pool].sort(() => rand() - 0.5).slice(0, 3);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HealthCheckPage() {
  const [step, setStep]       = useState<Step>('profile');
  const [profile, setProfile] = useState<Profile>({ sector:'', years:'', employees:'', turnover:'', uen:'', companyName:'', psgRef:'' });
  const [answers, setAnswers] = useState<Record<string, Set<number>>>({});
  const [errors, setErrors]   = useState<string[]>([]);

  function initAnswers() {
    const a: Record<string, Set<number>> = {};
    MEASURES.forEach(m => { a[m.id] = new Set(); });
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

  function toggle(measureId: string, optIdx: number, isNone: boolean) {
    setAnswers(prev => {
      const cur = new Set(prev[measureId] ?? []);
      const noneIdx = MEASURES.find(m => m.id === measureId)!.options.length - 1;
      if (isNone) {
        // selecting "None" clears everything and toggles None
        if (cur.has(noneIdx)) { cur.delete(noneIdx); } else { cur.clear(); cur.add(noneIdx); }
      } else {
        // selecting any option clears None
        cur.delete(noneIdx);
        if (cur.has(optIdx)) { cur.delete(optIdx); } else { cur.add(optIdx); }
      }
      return { ...prev, [measureId]: cur };
    });
  }

  const scores = useMemo(() => {
    const s: Record<string, number> = {};
    MEASURES.forEach(m => { s[m.id] = measureScore(m, answers[m.id] ?? new Set()); });
    return s;
  }, [answers]);

  const totalAnswered = useMemo(() => {
    return MEASURES.filter(m => (answers[m.id]?.size ?? 0) > 0).length;
  }, [answers]);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const base: React.CSSProperties = { minHeight:'100vh', background:'#f8fafc', color:'#0f172a', fontFamily:"'Segoe UI',system-ui,sans-serif" };
  const inputSt: React.CSSProperties = { width:'100%', padding:'0.7rem 0.875rem', borderRadius:'0.5rem', border:'1.5px solid #e2e8f0', background:'#fff', color:'#0f172a', fontSize:'0.95rem', outline:'none', boxSizing:'border-box' };
  const labelSt: React.CSSProperties = { display:'block', fontWeight:700, fontSize:'0.82rem', color:'#475569', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'0.35rem' };
  const cardSt:  React.CSSProperties = { background:'#fff', borderRadius:'1rem', border:'1px solid #e2e8f0', padding:'1.5rem', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };

  const StepBar = ({ active }: { active: number }) => (
    <div style={{ display:'flex', gap:'0.5rem', marginTop:'1.25rem' }}>
      {['Company Profile','Assessment','Your Results'].map((l, i) => (
        <div key={l} style={{ flex:1, textAlign:'center' }}>
          <div style={{ height:4, borderRadius:99, background: i < active ? '#22c55e' : i === active ? '#818cf8' : '#ffffff30', marginBottom:'0.3rem' }} />
          <span style={{ fontSize:'0.75rem', color: i < active ? '#86efac' : i === active ? '#c7d2fe' : '#ffffff50', fontWeight: i === active ? 700 : 400 }}>{l}</span>
        </div>
      ))}
    </div>
  );

  // ── STEP 1: PROFILE ────────────────────────────────────────────────────────
  if (step === 'profile') return (
    <div style={base}>
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#3730a3)', padding:'2rem 1.5rem 1.5rem', color:'#fff' }}>
        <div style={{ maxWidth:780, margin:'0 auto' }}>
          <a href="/game" style={{ color:'#a5b4fc', fontSize:'0.85rem', textDecoration:'none', display:'inline-block', marginBottom:'0.75rem' }}>← Back to Game</a>
          <h1 style={{ fontSize:'clamp(1.6rem,4vw,2.2rem)', fontWeight:900, margin:'0 0 0.4rem', lineHeight:1.2 }}>🏥 Cyber Health Check Tool</h1>
          <p style={{ color:'#a5b4fc', margin:0, fontSize:'0.95rem' }}>Based on CSA Singapore&apos;s Cyber Essentials framework · ~5 minutes</p>
          <StepBar active={0} />
        </div>
      </div>

      <div style={{ maxWidth:780, margin:'0 auto', padding:'2rem 1rem' }}>
        <div style={cardSt}>
          <h2 style={{ margin:'0 0 0.25rem', fontSize:'1.15rem' }}>Company Profile</h2>
          <p style={{ color:'#64748b', fontSize:'0.88rem', margin:'0 0 1.25rem' }}>Fields marked <span style={{ color:'#dc2626' }}>*</span> are required.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
            {[
              { key:'sector', label:'Sector', type:'select', opts:['Healthcare','Finance & Banking','Retail & E-Commerce','Manufacturing','Professional Services','Logistics & Transport','Education','Information & Communications','Construction & Real Estate','Food & Beverage','Government / Public Sector','Non-Profit','Other'] },
              { key:'years', label:'Years in Operation', type:'select', opts:['Less than 1 year','1 – 3 years','3 – 5 years','5 – 10 years','More than 10 years'] },
              { key:'employees', label:'Number of Employees', type:'select', opts:['1 – 9','10 – 49','50 – 199','200 or more'] },
              { key:'turnover', label:'Annual Sales Turnover (SGD)', type:'select', opts:['Less than $1M','$1M – $5M','$5M – $10M','$10M – $50M','More than $50M'] },
            ].map(f => (
              <div key={f.key}>
                <label style={labelSt}>{f.label} <span style={{ color:'#dc2626' }}>*</span></label>
                <select value={profile[f.key as keyof Profile]} onChange={e => setProfile(p => ({ ...p, [f.key]:e.target.value }))} style={{ ...inputSt, appearance:'auto' as React.CSSProperties['appearance'] }}>
                  <option value="">Select…</option>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          {errors.length > 0 && (
            <div style={{ marginTop:'1rem', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'0.5rem', padding:'0.75rem 1rem' }}>
              {errors.map(e => <p key={e} style={{ color:'#dc2626', margin:'0.1rem 0', fontSize:'0.88rem' }}>⚠ {e}</p>)}
            </div>
          )}
        </div>

        <div style={{ ...cardSt, marginTop:'1rem' }}>
          <h2 style={{ margin:'0 0 0.25rem', fontSize:'1.1rem' }}>Optional Details</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'1rem', marginTop:'1rem' }}>
            {[
              { key:'companyName', label:'Company Name', ph:'' },
              { key:'uen',         label:'UEN',          ph:'e.g. 202012345A' },
              { key:'psgRef',      label:'PSG Reference ID', ph:'e.g. PSG-2024-XXXXX' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelSt}>{f.label}</label>
                <input value={profile[f.key as keyof Profile]} placeholder={f.ph} onChange={e => setProfile(p => ({ ...p, [f.key]:e.target.value }))} style={inputSt} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'0.75rem', padding:'1rem 1.25rem', marginTop:'1rem', fontSize:'0.88rem', color:'#1e40af' }}>
          <strong>What happens next:</strong> You&apos;ll answer 9 questions (one per Cyber Essentials measure) by checking all practices your organisation has implemented. Your responses generate a personalised health score out of 100 with a breakdown vs the Singapore SME national average.
        </div>

        <button onClick={() => { if (validateProfile()) { initAnswers(); setStep('questions'); window.scrollTo(0,0); } }}
          style={{ marginTop:'1.5rem', width:'100%', padding:'1rem', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', borderRadius:'0.875rem', fontSize:'1.1rem', fontWeight:700, cursor:'pointer' }}>
          Want a more in-depth analysis? Start Assessment →
        </button>
      </div>
    </div>
  );

  // ── STEP 2: QUESTIONS ──────────────────────────────────────────────────────
  if (step === 'questions') {
    const pct = Math.round((totalAnswered / MEASURES.length) * 100);
    return (
      <div style={base}>
        <div style={{ position:'sticky', top:0, zIndex:50, background:'linear-gradient(135deg,#1e1b4b,#3730a3)', padding:'0.875rem 1.5rem', color:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
          <div style={{ maxWidth:780, margin:'0 auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.4rem' }}>
              <span style={{ fontWeight:700 }}>🏥 Cyber Health Check</span>
              <span style={{ fontSize:'0.82rem', color:'#a5b4fc' }}>{totalAnswered} / {MEASURES.length} questions answered</span>
            </div>
            <div style={{ height:6, background:'#ffffff25', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:'#818cf8', borderRadius:99, transition:'width 0.3s' }} />
            </div>
          </div>
        </div>

        <div style={{ maxWidth:780, margin:'0 auto', padding:'1.5rem 1rem 5rem' }}>
          <p style={{ color:'#64748b', fontSize:'0.88rem', marginBottom:'1.5rem' }}>
            For each question below, <strong>check all options that apply</strong> to your organisation. Select &quot;None of the above&quot; if none apply.
          </p>

          {MEASURES.map((m, mi) => {
            const checked = answers[m.id] ?? new Set<number>();
            const noneIdx = m.options.length - 1;
            const answered = checked.size > 0;
            return (
              <div key={m.id} style={{ ...cardSt, marginBottom:'1.25rem', borderLeft:`4px solid ${answered ? m.color : '#e2e8f0'}` }}>
                {/* Group chip */}
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <span style={{ background:`${m.color}15`, color:m.color, border:`1px solid ${m.color}40`, borderRadius:'99px', padding:'0.15rem 0.65rem', fontSize:'0.72rem', fontWeight:700 }}>
                    {m.group}
                  </span>
                  {answered && <span style={{ fontSize:'0.72rem', color:'#16a34a', fontWeight:700 }}>✓ Answered</span>}
                </div>

                {/* Measure header */}
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.875rem' }}>
                  <span style={{ fontSize:'1.8rem', flexShrink:0 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontWeight:800, fontSize:'1.05rem', color:m.color }}>{m.label}</div>
                    <div style={{ fontSize:'0.85rem', color:'#475569', marginTop:'0.2rem', lineHeight:1.5 }}>{m.question}</div>
                  </div>
                </div>

                <p style={{ fontSize:'0.78rem', color:'#94a3b8', fontStyle:'italic', margin:'0 0 0.875rem' }}>Please select all options that apply</p>

                <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                  {m.options.map((opt, oi) => {
                    const isNone = oi === noneIdx;
                    const sel = checked.has(oi);
                    return (
                      <label key={oi} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', cursor:'pointer', padding:'0.65rem 0.875rem', borderRadius:'0.625rem', border:`1.5px solid ${sel ? (isNone ? '#94a3b8' : m.color) : '#e2e8f0'}`, background: sel ? (isNone ? '#f1f5f9' : `${m.color}10`) : '#fff', transition:'all 0.1s' }}>
                        <input type="checkbox" checked={sel} onChange={() => toggle(m.id, oi, isNone)}
                          style={{ marginTop:'0.15rem', width:16, height:16, accentColor: isNone ? '#64748b' : m.color, flexShrink:0 }} />
                        <span style={{ fontSize:'0.88rem', color: isNone ? '#64748b' : '#1e293b', fontStyle: isNone ? 'italic' : 'normal', fontWeight: sel ? 600 : 400, lineHeight:1.5 }}>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ position:'sticky', bottom:'1rem' }}>
            <button onClick={() => { setStep('results'); window.scrollTo(0,0); }} disabled={totalAnswered < MEASURES.length}
              style={{ width:'100%', padding:'1rem', background: totalAnswered === MEASURES.length ? 'linear-gradient(135deg,#16a34a,#059669)' : '#94a3b8', color:'#fff', border:'none', borderRadius:'0.875rem', fontSize:'1.1rem', fontWeight:700, cursor: totalAnswered === MEASURES.length ? 'pointer' : 'not-allowed', boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>
              {totalAnswered < MEASURES.length
                ? `Answer all questions to continue (${MEASURES.length - totalAnswered} remaining)`
                : '📊 View My Cyber Health Score →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 3: RESULTS ────────────────────────────────────────────────────────
  const overall = overallScore(scores);
  const t = tier(overall);
  const providers = pickProviders(profile.employees, profile.companyName + profile.sector);
  const aboveAvg = overall >= 53;

  return (
    <div style={base}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#3730a3)', padding:'2rem 1.5rem 1.5rem', color:'#fff' }}>
        <div style={{ maxWidth:820, margin:'0 auto' }}>
          <h1 style={{ fontSize:'clamp(1.4rem,4vw,2rem)', fontWeight:900, margin:'0 0 0.3rem' }}>📊 Your Cyber Essentials Health Score</h1>
          <p style={{ color:'#a5b4fc', margin:0, fontSize:'0.95rem' }}>
            {profile.companyName ? `${profile.companyName} · ` : ''}{profile.sector}{profile.employees ? ` · ${profile.employees} employees` : ''}
          </p>
          <StepBar active={2} />
        </div>
      </div>

      <div style={{ maxWidth:820, margin:'0 auto', padding:'2rem 1rem 4rem' }}>

        {/* ── Overall score card ── */}
        <div style={{ ...cardSt, textAlign:'center', marginBottom:'1.25rem', background:'linear-gradient(135deg,#fafafa,#fff)' }}>
          <p style={{ color:'#64748b', margin:'0 0 0.25rem', fontSize:'0.82rem', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700 }}>Your Cyber Essentials health score is</p>
          <div style={{ fontSize:'clamp(4.5rem,14vw,7rem)', fontWeight:900, color:t.color, lineHeight:1 }}>{overall}</div>
          <div style={{ fontSize:'1.1rem', color:'#475569', margin:'0.15rem 0 0.5rem' }}><span style={{ fontWeight:700 }}>/100</span></div>
          {/* Score bar */}
          <div style={{ height:18, background:'#e2e8f0', borderRadius:99, overflow:'hidden', maxWidth:480, margin:'0.5rem auto' }}>
            <div style={{ height:'100%', width:`${overall}%`, background:t.color, borderRadius:99 }} />
          </div>
          <p style={{ color:'#64748b', fontSize:'0.88rem', margin:'0.5rem 0 0.75rem' }}>
            {aboveAvg
              ? <span>You are <strong style={{ color:'#16a34a' }}>above</strong> the national average of ~53</span>
              : <span>You are <strong style={{ color:'#dc2626' }}>below</strong> the national average of ~53</span>}
          </p>
          {/* Tier badge */}
          <div style={{ display:'inline-block', background:`${t.color}15`, border:`2px solid ${t.color}50`, borderRadius:'2rem', padding:'0.5rem 1.5rem' }}>
            <span style={{ fontWeight:800, color:t.color, fontSize:'1.1rem' }}>You are a {t.label}</span>
          </div>
          <p style={{ color:'#64748b', fontSize:'0.88rem', maxWidth:520, margin:'0.875rem auto 0', lineHeight:1.6 }}>{t.desc}</p>
        </div>

        {/* ── Score breakdown ── */}
        <div style={{ ...cardSt, marginBottom:'1.25rem' }}>
          <h2 style={{ margin:'0 0 1.25rem', fontSize:'1.1rem' }}>📈 Score Breakdown vs National Average</h2>

          {GROUPS.map(g => {
            const gMeasures = MEASURES.filter(m => g.measures.includes(m.id));
            return (
              <div key={g.id} style={{ marginBottom:'1.5rem' }}>
                {/* Group header */}
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem', paddingBottom:'0.5rem', borderBottom:'2px solid #f1f5f9' }}>
                  <span style={{ fontSize:'1.2rem' }}>{g.icon}</span>
                  <span style={{ fontWeight:800, fontSize:'1rem', color:'#1e293b' }}>{g.label}</span>
                </div>

                {gMeasures.map(m => {
                  const yours = scores[m.id];
                  const nat   = m.natAvg;
                  return (
                    <div key={m.id} style={{ marginBottom:'1rem', paddingLeft:'0.5rem' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.3rem' }}>
                        <span style={{ fontWeight:700, fontSize:'0.88rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                          <span>{m.icon}</span> {m.label}
                        </span>
                        <span style={{ fontSize:'0.8rem', color:'#64748b' }}>
                          You: <strong style={{ color:scoreColor(yours) }}>{yours}%</strong>
                          &nbsp;·&nbsp;Nat avg: <strong>{nat}%</strong>
                        </span>
                      </div>
                      {/* Bar track */}
                      <div style={{ position:'relative', height:14, background:'#f1f5f9', borderRadius:99, overflow:'visible' }}>
                        {/* Your score */}
                        <div style={{ height:'100%', width:`${yours}%`, background:scoreColor(yours), borderRadius:99 }} />
                        {/* National average marker */}
                        <div style={{ position:'absolute', top:'-4px', left:`${nat}%`, width:2, height:22, background:'#94a3b8', borderRadius:1 }} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'0.2rem' }}>
                        <span style={{ fontSize:'0.68rem', color:'#94a3b8' }}>▼ national avg ({nat}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:'0.875rem', fontSize:'0.75rem', color:'#94a3b8' }}>
            ▼ marker = Singapore SME national average · Source: CSA Singapore Cyber Landscape reports
          </div>

          {/* Social engineering callout */}
          <div style={{ marginTop:'1rem', background:'#fef9c3', border:'1px solid #fde047', borderRadius:'0.75rem', padding:'0.875rem 1.1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
            <span style={{ fontSize:'1.3rem', flexShrink:0 }}>⚠️</span>
            <p style={{ margin:0, fontSize:'0.85rem', color:'#713f12', lineHeight:1.6 }}>
              <strong>Did you know?</strong> Social engineering (phishing, impersonation, pretexting) is the <strong>#2 top cybersecurity incident</strong> affecting Singapore organisations — making People one of the most critical yet under-invested measures for SMEs.
              <br /><span style={{ fontSize:'0.75rem', color:'#92400e', marginTop:'0.25rem', display:'block' }}>Source: CSA&apos;s Cybersecurity Health Report 2023</span>
            </p>
          </div>
        </div>

        {/* ── CISO-as-a-Service ── */}
        <div style={{ ...cardSt, marginBottom:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'0.5rem', marginBottom:'1rem' }}>
            <div>
              <h2 style={{ margin:'0 0 0.25rem', fontSize:'1.1rem' }}>👔 CISO as-a-Service (Cyber Essentials)</h2>
              <p style={{ color:'#64748b', fontSize:'0.82rem', margin:0 }}>
                Receive funding-supported assistance from CSA-approved cybersecurity consultants. Matched to your organisation size ({profile.employees} employees).
              </p>
            </div>
            <a href="https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-certification-for-organisations/ciso-as-a-service-to-develop-cybersecurity-health-plan/"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize:'0.8rem', color:'#4f46e5', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
              Learn more about CISOaaS →
            </a>
          </div>
          <div style={{ display:'grid', gap:'0.875rem' }}>
            {providers.map(p => (
              <div key={p.rank} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'0.875rem', padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.5rem' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#1e293b' }}>{p.name}</div>
                  <div style={{ color:'#64748b', fontSize:'0.82rem', marginTop:'0.15rem' }}>Contact: {p.contact}</div>
                </div>
                <div style={{ display:'flex', gap:'0.875rem', alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
                  <a href={`mailto:${p.email}`} style={{ color:'#4f46e5', fontSize:'0.83rem', fontWeight:700, textDecoration:'none' }}>✉️ {p.email}</a>
                  <span style={{ color:'#64748b', fontSize:'0.83rem' }}>📞 {p.phone}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'0.875rem', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'0.5rem', padding:'0.75rem 1rem', fontSize:'0.82rem', color:'#1e40af' }}>
            💡 Eligible SMEs receive up to 70% funding support under the CSA CISOaaS scheme. Contact a provider above to get started.
          </div>
        </div>

        {/* ── Certifications & resources ── */}
        <div style={{ ...cardSt, marginBottom:'1.25rem' }}>
          <h2 style={{ margin:'0 0 1rem', fontSize:'1.1rem' }}>🏅 Cybersecurity Certifications</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'0.875rem' }}>
            {[
              { icon:'🛡️', title:'Cyber Essentials Mark', desc:'For SMEs embarking on their cybersecurity journey. Recognised certification for basic cyber hygiene.', url:'https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-certification-for-organisations/cyber-essentials', color:'#4f46e5' },
              { icon:'🔰', title:'Cyber Trust Mark', desc:'For SMEs with more extensive digitalised operations facing higher cyber risk.', url:'https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-certification-for-organisations/cyber-trust', color:'#0891b2' },
              { icon:'💻', title:'Cyber Essentials Readiness Scan (Device)', desc:'Run an automated device security scan right now — free tool from CSA.', url:'https://cetool-mvp.vercel.app/', color:'#16a34a' },
            ].map(n => (
              <a key={n.title} href={n.url} target="_blank" rel="noopener noreferrer"
                style={{ background:'#fff', border:`2px solid ${n.color}25`, borderRadius:'1rem', padding:'1.25rem', textDecoration:'none', color:'#1e293b', display:'block' }}>
                <div style={{ fontSize:'1.75rem', marginBottom:'0.4rem' }}>{n.icon}</div>
                <div style={{ fontWeight:800, fontSize:'0.95rem', color:n.color }}>{n.title}</div>
                <div style={{ color:'#64748b', fontSize:'0.82rem', marginTop:'0.25rem', lineHeight:1.5 }}>{n.desc}</div>
                <div style={{ color:n.color, fontSize:'0.8rem', fontWeight:700, marginTop:'0.5rem' }}>Learn more →</div>
              </a>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
          <button onClick={() => { setStep('profile'); setErrors([]); window.scrollTo(0,0); }}
            style={{ padding:'0.75rem 1.5rem', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'0.75rem', color:'#475569', fontWeight:700, cursor:'pointer', fontSize:'0.95rem' }}>
            ← Start Over
          </button>
          <button onClick={() => { setStep('questions'); window.scrollTo(0,0); }}
            style={{ padding:'0.75rem 1.5rem', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'0.75rem', color:'#475569', fontWeight:700, cursor:'pointer', fontSize:'0.95rem' }}>
            ✏️ Edit Answers
          </button>
          <a href="/game" style={{ padding:'0.75rem 1.5rem', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:'0.75rem', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'0.95rem', textDecoration:'none' }}>
            🎮 Back to Game
          </a>
        </div>
      </div>
    </div>
  );
}
