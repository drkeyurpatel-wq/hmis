import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Health1 HMIS',
  description: 'Health1 Hospital Management Information System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
