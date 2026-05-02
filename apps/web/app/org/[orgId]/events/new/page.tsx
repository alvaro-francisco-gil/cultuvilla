'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOrganization } from '@villa-events/shared/services/organizationService';
import { getVillage } from '@villa-events/shared/services/villageService';
import { createEvent } from '@villa-events/shared/services/eventService';
import { useAuth } from '@/hooks/useAuth';
import { EventForm, type EventFormData } from '@/components/event/EventForm';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { ArrowLeft } from 'lucide-react';
import type { OrganizationData } from '@villa-events/shared/models/organization';

interface NewEventPageProps {
  params: Promise<{ orgId: string }>;
}

export default function NewEventPage({ params }: NewEventPageProps) {
  const { orgId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [org, setOrg] = useState<(OrganizationData & { id: string }) | null>(null);

  useEffect(() => {
    getOrganization(orgId).then(setOrg);
  }, [orgId]);

  const handleSubmit = async (data: EventFormData) => {
    if (!user || !org) return;
    const village = await getVillage(org.villageId);
    const villageImages = village?.images ?? [];
    const newId = await createEvent({
      ...data,
      organizationId: orgId,
      organizationName: org.name,
      createdBy: user.uid,
      status: 'draft',
      villageId: org.villageId,
      villageName: village?.name ?? '',
      villageCoverImage: villageImages.length > 0 ? villageImages[0] : null,
      villageCoordinates: village?.coordinates ?? null,
    });
    router.push(`/event/${newId}`);
  };

  if (!org) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-6 w-40" />
        <SkeletonLoader className="h-12" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <Link href={`/org/${orgId}`} className="flex items-center gap-1 text-blue-600 text-sm mb-4">
        <ArrowLeft size={16} /> Volver
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo evento</h1>
      <p className="text-sm text-gray-500 mb-4">Organización: {org.name}</p>
      <EventForm
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        submitLabel="Crear evento"
      />
    </div>
  );
}
