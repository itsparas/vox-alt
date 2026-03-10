import '@/styles/globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'VoxReception - AI Receptionist',
  description: 'Multi-tenant AI receptionist SaaS platform with voice, booking, and escalation capabilities',
  keywords: ['AI receptionist', 'virtual receptionist', 'voice AI', 'booking system', 'SaaS'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-secondary-50 dark:bg-secondary-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
