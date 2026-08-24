'use client';

export const dynamic = 'force-dynamic';

// End-of-game resource guide — clickable links to CSA Singapore programmes

const RESOURCES = [
  {
    title: 'Cyber Essentials Mark',
    description: 'A certification scheme that helps businesses adopt a foundational set of cybersecurity measures to protect from common attacks.',
    icon: '🛡️',
    url: 'https://go.gov.sg/cyber-essentials',
    color: '#6366f1',
    tag: 'Certification',
  },
  {
    title: 'Cyber Trust Mark',
    description: 'For organisations with more complex IT setups — a higher-level certification recognising comprehensive cybersecurity practices.',
    icon: '🏆',
    url: 'https://go.gov.sg/cyber-trust',
    color: '#f59e0b',
    tag: 'Certification',
  },
  {
    title: 'Cybersecurity Self-Assessment',
    description: 'A FREE online questionnaire to assess your organisation\'s cybersecurity posture aligned to Cyber Essentials.',
    icon: '📋',
    url: 'https://isomer-user-content.by.gov.sg/36/f9481424-2c5a-4e02-a113-0f18ed7cd4ef/cyber-essentials-self-assessment-v202504.xlsx',
    color: '#22c55e',
    tag: 'Self-Help Tool',
  },
  {
    title: 'Cybersecurity Health Check',
    description: 'A subsidised assessment by a CSA-recognised auditor to evaluate your cybersecurity posture and get actionable recommendations.',
    icon: '🏥',
    url: 'https://smesgodigital.gov.sg/web/CyberHealthCheckCSA',
    color: '#06b6d4',
    tag: 'Subsidised Service',
  },
  {
    title: 'SG Cyber Safe Toolkits',
    description: 'Practical cybersecurity toolkits for businesses — templates, checklists, and guides to protect your organisation.',
    icon: '🧰',
    url: 'https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-resources-for-organisations/',
    color: '#f97316',
    tag: 'Free Resource',
  },
  {
    title: 'CISO-as-a-Service',
    description: 'Get access to an experienced Chief Information Security Officer on a flexible basis — ideal for SMEs without a full-time CISO.',
    icon: '👔',
    url: 'https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-certification-for-organisations/ciso-as-a-service-to-develop-cybersecurity-health-plan/',
    color: '#a855f7',
    tag: 'Advisory Service',
  },
  {
    title: 'CSA Singapore',
    description: 'The Cyber Security Agency of Singapore — your national cybersecurity authority. Explore all programmes, resources, and alerts.',
    icon: '🏛️',
    url: 'https://www.csa.gov.sg',
    color: '#C8102E',
    tag: 'Official Site',
  },
];

export default function ResourcesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '0 0 4rem' }}>
      {/* Header */}
      <div style={{ background: 'rgba(200,16,46,0.12)', borderBottom: '2px solid rgba(200,16,46,0.3)', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>🛡️ Stay Cyber Safe</h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>CSA Singapore resources to help protect your organisation</p>
        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', background: 'rgba(200,16,46,0.15)', border: '1px solid rgba(200,16,46,0.35)', borderRadius: '0.625rem', padding: '0.45rem 1rem' }}>
          <span style={{ fontSize: '0.9rem' }}>🏅</span>
          <span style={{ fontSize: '0.88rem', color: '#fca5a5', fontWeight: 600 }}>Based on the <span style={{ color: '#fff' }}>Cyber Essentials Mark</span> framework</span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Key message */}
        <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '1.25rem', padding: '1.5rem 2rem', marginBottom: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '3rem' }}>💡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.4rem' }}>Take the Next Step</div>
            <p style={{ color: '#a5b4fc', margin: 0, lineHeight: 1.7 }}>Click any card below to access FREE and subsidised resources from CSA Singapore. The <strong style={{ color: '#fff' }}>Cyber Essentials Mark</strong> certification can help your organisation demonstrate strong cybersecurity practices to customers and partners.</p>
          </div>
        </div>

        {/* Resource cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {RESOURCES.map(r => (
            <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${r.color}30`, borderRadius: '1.25rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textDecoration: 'none', color: '#fff', transition: 'all 0.15s', cursor: 'pointer' }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = `${r.color}12`; (e.currentTarget as HTMLElement).style.borderColor = `${r.color}70`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = `${r.color}30`; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
              {/* Top row: icon + text */}
              <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '2.25rem', flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{r.title}</span>
                    <span style={{ background: `${r.color}20`, color: r.color, borderRadius: '0.375rem', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.tag}</span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{r.description}</p>
                </div>
              </div>
              {/* Link indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${r.color}20` }}>
                <span style={{ color: r.color, fontWeight: 700, fontSize: '0.82rem' }}>🔗 Tap to visit</span>
                <span style={{ color: '#475569', fontSize: '0.72rem', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{r.url}</span>
              </div>
            </a>
          ))}
        </div>

        {/* 5 Pillars recap */}
        <div style={{ marginTop: '3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', padding: '1.75rem 2rem' }}>
          <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.3rem' }}>📌 Cyber Essentials — The 5 Pillars</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem' }}>
            {[
              { icon: '📦', label: 'ASSETS', desc: 'Know your people, hardware, software & data' },
              { icon: '🛡️', label: 'SECURE', desc: 'Protect with firewalls, MFA & access control' },
              { icon: '🔄', label: 'UPDATE', desc: 'Patch software regularly — no delay' },
              { icon: '💾', label: 'BACKUP', desc: 'Backup data regularly & test restores' },
              { icon: '🚨', label: 'RESPOND', desc: 'Detect, report & recover from incidents' },
            ].map(p => (
              <div key={p.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.875rem', padding: '0.875rem 1rem' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>{p.icon}</div>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#a5b4fc', marginBottom: '0.3rem' }}>{p.label}</div>
                <div style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.2)', borderRadius: '1rem' }}>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Thank you for playing <strong style={{ color: '#fff' }}>Cyber Essentials in Action</strong>.<br />
            Developed for CSA Singapore&apos;s cybersecurity awareness outreach. Visit <span style={{ color: '#fca5a5' }}>csa.gov.sg</span> to learn more.
          </p>
        </div>
      </div>
    </div>
  );
}
