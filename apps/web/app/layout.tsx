import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/common/BottomNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Villa Events',
  description: 'Eventos de tu pueblo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>
          <main className="pb-20 max-w-lg mx-auto min-h-screen">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
