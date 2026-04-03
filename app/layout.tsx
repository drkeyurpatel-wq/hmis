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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Health1 HMIS',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
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
        <script dangerouslySetInnerHTML={{ __html: `
          // Force-unregister broken service worker that was blocking navigation
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              registrations.forEach(function(registration) {
                registration.unregister().then(function(success) {
                  if (success) console.log('[H1] Old service worker unregistered');
                });
              });
            });
            // Clear all SW caches
            if ('caches' in window) {
              caches.keys().then(function(names) {
                names.forEach(function(name) { caches.delete(name); });
              });
            }
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
