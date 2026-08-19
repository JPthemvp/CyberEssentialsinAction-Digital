import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cyber Essentials in Action',
  description: 'A cybersecurity awareness game by CSA Singapore',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0f0f1a' }}>
        {children}
      </body>
    </html>
  );
}
