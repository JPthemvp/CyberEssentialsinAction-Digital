// Player icon + name encoding helpers
// Icons are encoded into player_name as "🦁|Alex" so no DB schema change is needed.

export const PLAYER_ICONS = [
  '🦁', '🐯', '🦊', '🐺', '🐻', '🐼', '🦄', '🐲',
  '🦅', '🦋', '🚀', '⚡', '🌟', '🎯', '🔥', '🤖',
  '💎', '🕵️', '🐸', '🦈',
];

/** Encode icon + display name for storage in player_name column */
export function encodePlayerName(icon: string, name: string): string {
  return `${icon}|${name}`;
}

/** Parse stored player_name back to { icon, name } */
export function parsePlayerName(stored: string): { icon: string; name: string } {
  const sep = stored.indexOf('|');
  if (sep > 0) {
    const maybeIcon = stored.slice(0, sep);
    if (PLAYER_ICONS.includes(maybeIcon)) {
      return { icon: maybeIcon, name: stored.slice(sep + 1) };
    }
  }
  // Legacy player (no icon encoded) — give a default
  return { icon: '🎮', name: stored };
}
