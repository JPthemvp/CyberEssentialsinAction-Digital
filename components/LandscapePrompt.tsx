'use client';

import { useState, useEffect } from 'react';

/**
 * Shows a dismissible overlay on mobile phones in portrait orientation
 * suggesting the player tilt to landscape for a better experience.
 * Automatically hides when the device is already in landscape.
 */
export default function LandscapePrompt() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show on real touch phones (not tablets or desktops)
    const isMobilePhone = () =>
      window.matchMedia('(max-width: 640px) and (pointer: coarse)').matches;

    const isPortrait = () =>
      window.innerHeight > window.innerWidth;

    const update = () => {
      if (!dismissed && isMobilePhone() && isPortrait()) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [dismissed]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Landscape suggestion"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #1e1b4b, #0f0f1a)',
        borderTop: '2px solid rgba(99,102,241,0.5)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      {/* Rotation icon */}
      <div
        style={{
          fontSize: '2rem',
          flexShrink: 0,
          animation: 'spin90 1.2s ease-in-out infinite alternate',
          display: 'inline-block',
        }}
      >
        📱
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#a5b4fc', marginBottom: '0.15rem' }}>
          Tilt your phone sideways!
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.4 }}>
          Landscape mode gives you the best game experience 🎮
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => { setDismissed(true); setVisible(false); }}
        aria-label="Dismiss"
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '0.5rem',
          color: '#94a3b8',
          fontSize: '1.1rem',
          padding: '0.35rem 0.65rem',
          cursor: 'pointer',
          flexShrink: 0,
          minWidth: 40,
          minHeight: 40,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes spin90 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-90deg); }
        }
      `}</style>
    </div>
  );
}
