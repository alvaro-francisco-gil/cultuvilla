'use client';

import { use } from 'react';
import { VillageProvider } from '@/contexts/VillageContext';

interface VillageLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function VillageLayout({ children, params }: VillageLayoutProps) {
  const { id } = use(params);

  return (
    <VillageProvider municipalityId={id}>
      {children}
    </VillageProvider>
  );
}
