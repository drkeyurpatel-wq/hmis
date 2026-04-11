import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40af',
};

export const metadata: Metadata = {
  title: 'Health1 HMIS',
  description: 'Health1 Super Speciality Hospitals — Hospital Management Information System',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/health1-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Auto-unregister stale service workers that break navigation */}
        <script dangerouslySetInnerHTML={{ __html: `
          if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(reg){reg.unregister()})});caches.keys().then(function(k){k.forEach(function(c){caches.delete(c)})});}
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
