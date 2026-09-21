import { useMemo } from 'react';
import { Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { Screen, VStack, HStack, Text, Pressable } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import {
  snapshot,
  sourceUrl,
  snapshotAgeDays,
  diasHasta,
  type BusinessCard,
  type BusinessKind,
} from '../../lib/business/snapshot';

// Hardcoded Spanish: this is an internal admin surface, which is the one
// carve-out AGENTS.md makes to the i18n rule.
const KIND_LABEL: Record<BusinessKind, string> = {
  convocatoria: 'Convocatorias',
  evento: 'Encuentros',
  entidad: 'Entidades',
  propuesta: 'Propuestas',
};

const KIND_HINT: Record<BusinessKind, string> = {
  convocatoria: 'Dinero que podríamos conseguir',
  evento: 'Salas en las que conviene estar',
  entidad: 'Financiadores, colaboradores, administraciones',
  propuesta: 'Candidaturas que estamos escribiendo',
};

const STATE_LABEL: Record<string, string> = {
  watching: 'vigilando',
  candidate: 'candidata',
  preparing: 'preparando',
  submitted: 'presentada',
  won: 'ganada',
  lost: 'perdida',
  expired: 'caducada',
  registered: 'inscritos',
  attended: 'asistimos',
  skipped: 'descartado',
  borrador: 'borrador',
  lista: 'lista',
  enviada: 'enviada',
  retirada: 'retirada',
  'sin-contacto': 'sin contacto',
  contactado: 'contactado',
  conversando: 'conversando',
  colaborando: 'colaborando',
  descartado: 'descartado',
};

const FIT_LABEL = { high: 'encaje alto', medium: 'encaje medio', low: 'encaje bajo' } as const;

function Chip({ text, tone }: { text: string; tone: 'danger' | 'muted' | 'success' }) {
  const bg = tone === 'danger' ? 'bg-danger-subtle' : tone === 'success' ? 'bg-success-subtle' : 'bg-subtle';
  return (
    <View className={`${bg} rounded-sm px-2 py-0.5`}>
      <Text variant="caption" tone={tone === 'muted' ? 'muted' : tone}>
        {text}
      </Text>
    </View>
  );
}

function SectionTitle({ title, hint, count }: { title: string; hint?: string; count?: number }) {
  return (
    <VStack gap={0} className="mt-6 mb-2">
      <HStack gap={2} className="items-baseline">
        <Text variant="h3">{title}</Text>
        {count !== undefined && (
          <Text variant="caption" tone="muted">
            {count}
          </Text>
        )}
      </HStack>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </VStack>
  );
}

/** Every card links to its Markdown in git — the reasoning lives there, not here. */
function CardRow({ card, lead }: { card: BusinessCard; lead?: string }) {
  const dias = card.deadline ? diasHasta(card.deadline) : null;
  const state = card.status ?? card.relacion;
  return (
    <Pressable
      onPress={() => void Linking.openURL(sourceUrl(card))}
      className="bg-surface border border-subtle rounded-lg p-3"
    >
      <HStack gap={2} className="items-start">
        <View className="flex-1">
          <Text>{card.titulo}</Text>
          <HStack gap={1} className="mt-1 flex-wrap items-center">
            {lead ? <Chip text={lead} tone="danger" /> : null}
            {state ? <Chip text={STATE_LABEL[state] ?? state} tone="muted" /> : null}
            {card.fit ? <Chip text={FIT_LABEL[card.fit]} tone="muted" /> : null}
            {card.kind === 'propuesta' ? (
              <Chip
                text={card.holes === 0 ? 'sin huecos' : `${String(card.holes)} huecos`}
                tone={card.holes === 0 ? 'success' : 'muted'}
              />
            ) : null}
          </HStack>
          {card.convocante || card.importe || card.lugar ? (
            <Text variant="caption" tone="muted" className="mt-1">
              {[card.convocante, card.importe, card.lugar].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {dias !== null && !lead ? (
            <Text variant="caption" tone="muted" className="mt-1">
              {dias < 0 ? `plazo vencido hace ${String(-dias)} días` : `quedan ${String(dias)} días`}
            </Text>
          ) : null}
        </View>
        <Ionicons name="open-outline" size={iconSizes.sm} />
      </HStack>
    </Pressable>
  );
}

export default function BusinessDashboardScreen() {
  const age = useMemo(() => snapshotAgeDays(snapshot.generatedAt), []);
  // Recomputed against today, not read from the file: the snapshot is only as
  // fresh as the last deploy and a wrong day count is worse than none.
  const urgente = useMemo(
    () =>
      snapshot.urgente
        .map((c) => ({ ...c, dias: c.deadline ? diasHasta(c.deadline) : 0 }))
        .filter((c) => c.dias >= 0)
        .sort((a, b) => a.dias - b.dias),
    [],
  );

  return (
    <Screen padded={false} scroll>
      <ScreenHeader title="Negocio" />
      <VStack gap={0} className="p-4">
        <Text variant="caption" tone="muted">
          {age === 0
            ? 'Datos del registro, actualizados hoy.'
            : `Datos del registro, de hace ${String(age)} ${age === 1 ? 'día' : 'días'} (se actualizan en cada despliegue).`}
        </Text>

        <SectionTitle
          title="Con reloj"
          hint="Plazos dentro de los próximos 30 días. Lo único con coste por llegar tarde."
          count={urgente.length}
        />
        <VStack gap={2}>
          {urgente.length === 0 ? (
            <Text tone="muted">Nada vence en los próximos 30 días.</Text>
          ) : (
            urgente.map((c) => (
              <CardRow key={`u-${c.id}`} card={c} lead={c.dias === 0 ? 'hoy' : `${String(c.dias)} días`} />
            ))
          )}
        </VStack>

        {snapshot.propuestasIncompletas.length > 0 && (
          <>
            <SectionTitle
              title="Marcadas listas pero con huecos"
              hint="Creer que una candidatura está terminada es el fallo que más cuesta."
              count={snapshot.propuestasIncompletas.length}
            />
            <VStack gap={2}>
              {snapshot.propuestasIncompletas.map((c) => (
                <CardRow key={`i-${c.id}`} card={c} />
              ))}
            </VStack>
          </>
        )}

        {snapshot.caducadas.length > 0 && (
          <>
            <SectionTitle
              title="Plazo vencido sin cerrar"
              hint="Hay que marcarlas como caducadas o avanzarlas."
              count={snapshot.caducadas.length}
            />
            <VStack gap={2}>
              {snapshot.caducadas.map((c) => (
                <CardRow key={`c-${c.id}`} card={c} />
              ))}
            </VStack>
          </>
        )}

        {(['propuesta', 'convocatoria', 'evento', 'entidad'] as BusinessKind[]).map((kind) => (
          <View key={kind}>
            <SectionTitle title={KIND_LABEL[kind]} hint={KIND_HINT[kind]} count={snapshot.counts[kind]} />
            <VStack gap={2}>
              {snapshot.byKind[kind].map((c) => (
                <CardRow key={`${kind}-${c.id}`} card={c} />
              ))}
            </VStack>
          </View>
        ))}

        <Text variant="caption" tone="muted" className="mt-8">
          Cada ficha abre su Markdown en GitHub, donde está el razonamiento completo.
        </Text>
      </VStack>
    </Screen>
  );
}
