'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useVillage } from '@/hooks/useVillage';
import { useIsAppAdmin } from '@/hooks/useIsAppAdmin';
import {
  getOrganizationsByMunicipality,
  approveOrganization,
  rejectOrganization,
} from '@cultuvilla/shared/services/organizationService';
import { addOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import {
  createInviteToken,
  getInviteTokens,
  deleteInviteToken,
} from '@cultuvilla/shared/services/inviteTokenService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { InviteTokenData } from '@cultuvilla/shared/models/municipality';
import { OrgCard } from '@/components/organization/OrgCard';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { ArrowLeft, Plus, Copy, Trash2, Users, Link as LinkIcon, ClipboardList } from 'lucide-react';

interface AdminPageProps {
  params: Promise<{ id: string }>;
}

export default function VillageAdminPage({ params }: AdminPageProps) {
  const { id: municipalityId } = use(params);
  const { user } = useAuth();
  const { isAdmin, loading: villageLoading } = useVillage();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const router = useRouter();
  const canManage = isAdmin || isAppAdmin;

  const [orgs, setOrgs] = useState<(OrganizationData & { id: string })[]>([]);
  const [tokens, setTokens] = useState<(InviteTokenData & { id: string })[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creatingToken, setCreatingToken] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (villageLoading || appAdminLoading) return;
    if (!canManage) router.push(`/village/${municipalityId}`);
  }, [canManage, villageLoading, appAdminLoading, router, municipalityId]);

  useEffect(() => {
    if (!canManage) return;
    async function load() {
      const [allOrgs, allTokens, members] = await Promise.all([
        getOrganizationsByMunicipality(municipalityId),
        getInviteTokens(municipalityId),
        getVillageMembers(municipalityId),
      ]);
      setOrgs(allOrgs);
      setTokens(allTokens);
      setMemberCount(members.length);
      setLoading(false);
    }
    load();
  }, [municipalityId, canManage]);

  const handleApprove = async (orgId: string) => {
    await approveOrganization(orgId, user!.uid);
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      await addOrgMember(orgId, org.requestedBy);
    }
    setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, status: 'approved' as const } : o));
  };

  const handleReject = async (orgId: string) => {
    await rejectOrganization(orgId);
    setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, status: 'rejected' as const } : o));
  };

  const handleCreateToken = async () => {
    setCreatingToken(true);
    try {
      const tokenId = await createInviteToken(municipalityId);
      const newTokens = await getInviteTokens(municipalityId);
      setTokens(newTokens);
      const url = `${window.location.origin}/invite/${tokenId}?v=${municipalityId}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(tokenId);
      setTimeout(() => setCopiedId(null), 2000);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleCopyToken = async (tokenId: string) => {
    const url = `${window.location.origin}/invite/${tokenId}?v=${municipalityId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!confirm('¿Eliminar este enlace de invitación?')) return;
    await deleteInviteToken(municipalityId, tokenId);
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
  };

  if (villageLoading || appAdminLoading || loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        <SkeletonLoader className="h-20 rounded-xl" />
        <SkeletonLoader className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!canManage) return null;

  const pendingOrgs = orgs.filter((o) => o.status === 'pending');
  const approvedOrgs = orgs.filter((o) => o.status === 'approved');

  return (
    <div className="px-4 py-6">
      <Link href={`/village/${municipalityId}`} className="flex items-center gap-1 text-blue-600 text-sm mb-4">
        <ArrowLeft size={16} /> Volver al pueblo
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Coordinación del pueblo</h1>

      {/* Stats */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-3">
        <Users size={20} className="text-blue-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}</p>
          <p className="text-xs text-gray-500">en este pueblo</p>
        </div>
      </div>

      {/* Censo link */}
      <Link
        href={`/village/${municipalityId}/admin/censo`}
        className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex items-center gap-3 hover:border-blue-400 hover:bg-blue-50 transition"
      >
        <ClipboardList size={20} className="text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Censo del pueblo</p>
          <p className="text-xs text-gray-500">Define las preguntas que los miembros deben responder.</p>
        </div>
      </Link>

      {/* Invite tokens */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <LinkIcon size={18} className="text-gray-500" />
            Enlaces de invitación
          </h2>
          <button
            onClick={handleCreateToken}
            disabled={creatingToken}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Plus size={15} /> Crear
          </button>
        </div>

        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No hay enlaces de invitación.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div key={token.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-gray-600 truncate">{token.id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Usado {token.usageCount} {token.usageCount === 1 ? 'vez' : 'veces'}
                    {token.expiresAt && ` · expira ${token.expiresAt.toLocaleDateString('es-ES')}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopyToken(token.id)}
                    className={`p-2 rounded-lg transition ${copiedId === token.id ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    title="Copiar enlace"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteToken(token.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending org requests */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Solicitudes pendientes ({pendingOrgs.length})
        </h2>
        {pendingOrgs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No hay solicitudes pendientes.</p>
        ) : (
          <div className="space-y-3">
            {pendingOrgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                showApproveReject
                onApprove={() => handleApprove(org.id)}
                onReject={() => handleReject(org.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Approved orgs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Organizaciones aprobadas ({approvedOrgs.length})
        </h2>
        {approvedOrgs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No hay organizaciones aprobadas todavía.</p>
        ) : (
          <div className="space-y-3">
            {approvedOrgs.map((org) => (
              <Link key={org.id} href={`/org/${org.id}`}>
                <OrgCard org={org} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
