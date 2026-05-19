'use client';

import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import { CheckCircle, XCircle } from 'lucide-react';

interface OrgCardProps {
  org: OrganizationData & { id: string };
  showApproveReject?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

const orgTypeLabel: Record<OrganizationData['type'], string> = {
  ayuntamiento: 'Ayuntamiento',
  peña: 'Peña',
  asociación: 'Asociación',
};

const orgStatusLabel: Record<OrganizationData['status'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const orgStatusColor: Record<OrganizationData['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export function OrgCard({ org, showApproveReject, onApprove, onReject }: OrgCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-gray-900">{org.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${orgStatusColor[org.status]}`}>
          {orgStatusLabel[org.status]}
        </span>
      </div>
      <p className="text-xs text-gray-500">{orgTypeLabel[org.type]}</p>
      {org.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{org.description}</p>
      )}

      {showApproveReject && org.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 flex-1 justify-center bg-green-50 border border-green-200 text-green-700 py-2 rounded-xl text-sm font-medium hover:bg-green-100 transition"
          >
            <CheckCircle size={15} /> Aprobar
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 flex-1 justify-center bg-red-50 border border-red-200 text-red-700 py-2 rounded-xl text-sm font-medium hover:bg-red-100 transition"
          >
            <XCircle size={15} /> Rechazar
          </button>
        </div>
      )}
    </div>
  );
}
