import '@/lib/firebaseInit';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/common/BottomNav';
import { ProfileGuard } from '@/components/auth/ProfileGuard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Cultuvilla',
    template: '%s · Cultuvilla',
  },
  description: 'Eventos de tu pueblo',
  applicationName: 'Cultuvilla',
  openGraph: {
    title: 'Cultuvilla',
    description: 'Eventos de tu pueblo',
    siteName: 'Cultuvilla',
    type: 'website',
    locale: 'es_ES',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <ErrorBoundary>
          <AuthProvider>
            <ProfileGuard>
              <main className="pb-20 max-w-lg mx-auto min-h-screen">{children}</main>
              <BottomNav />
            </ProfileGuard>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
