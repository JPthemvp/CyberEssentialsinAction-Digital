export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-root" style={{ minHeight: '100vh', background: '#0f0f1a' }}>
      {children}
    </div>
  );
}
