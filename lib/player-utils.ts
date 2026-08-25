// Player icon + name encoding helpers
// Icons are encoded into player_name as "🦁|Alex" so no DB schema change is needed.

/** Categorised icon sets shown in the picker */
export const ICON_CATEGORIES: { label: string; emoji: string; icons: string[] }[] = [
  {
    label: 'Warriors',
    emoji: '⚔️',
    icons: ['🧙', '🛡️', '⚔️', '🗡️', '🏹', '🪄', '🧝', '🧛', '🤺', '🦸', '🦹', '🥷'],
  },
  {
    label: 'Animals',
    emoji: '🦁',
    icons: ['🦁', '🐯', '🦊', '🐺', '🐻', '🐼', '🦄', '🐲', '🦅', '🦋', '🐸', '🦈', '🐉', '🦖', '🦁', '🐘'],
  },
  {
    label: 'Cute & Sweet',
    emoji: '🍭',
    icons: ['🍭', '🍬', '🧁', '🎀', '🌸', '🌺', '💖', '🦩', '🐱', '🐰', '🧸', '🍓', '🍑', '🌷', '🦢', '👑'],
  },
  {
    label: 'Power',
    emoji: '⚡',
    icons: ['⚡', '🔥', '💥', '🌪️', '❄️', '🌊', '☄️', '🌟', '💫', '✨', '🎯', '💎'],
  },
  {
    label: 'Tech & Space',
    emoji: '🤖',
    icons: ['🤖', '🚀', '🛸', '👾', '🕹️', '💻', '🔬', '🧬', '⚙️', '🔭', '🛰️', '🌐'],
  },
  {
    label: 'Spy & Mystery',
    emoji: '🕵️',
    icons: ['🕵️', '🎭', '🎩', '🗝️', '🔍', '💼', '🧩', '🃏', '👁️', '🦇', '🌙', '🎱'],
  },
];

/** Flat list of all icons — used for validation and legacy fallback */
export const PLAYER_ICONS: string[] = ICON_CATEGORIES.flatMap(c => c.icons);

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
