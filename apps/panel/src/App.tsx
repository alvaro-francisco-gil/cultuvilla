import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import {
  BusinessSnapshotSchema,
  daysBetweenIsoDates,
  type BusinessCard,
  type BusinessKind,
  type BusinessSnapshot,
} from '@cultuvilla/shared/models';
import { auth, functions, googleProvider, missingConfig } from './firebase';

// Hardcoded Spanish: this tool has exactly two users and no localisation need.
const KIND_LABEL: Record<BusinessKind, string> = {
  propuesta: 'Propuestas',
  convocatoria: 'Convocatorias',
  evento: 'Encuentros',
  entidad: 'Entidades',
};

const KIND_HINT: Record<BusinessKind, string> = {
  propuesta: 'Candidaturas que estamos escribiendo',
  convocatoria: 'Dinero que podríamos conseguir',
  evento: 'Salas en las que conviene estar',
  entidad: 'Financiadores, colaboradores, administraciones',
};

const STATE_LABEL: Record<string, string> = {
  watching: 'vigilando', candidate: 'candidata', preparing: 'preparando',
  submitted: 'presentada', won: 'ganada', lost: 'perdida', expired: 'caducada',
  registered: 'inscritos', attended: 'asistimos', skipped: 'descartado',
  borrador: 'borrador', lista: 'lista', enviada: 'enviada', retirada: 'retirada',
  'sin-contacto': 'sin contacto', contactado: 'contactado', conversando: 'conversando',
  colaborando: 'colaborando', descartado: 'descartado',
};

const FIT_LABEL = { high: 'encaje alto', medium: 'encaje medio', low: 'encaje bajo' } as const;
const REPO = 'https://github.com/alvaro-francisco-gil/cultuvilla/blob/develop';
const todayIso = (): string => new Date().toISOString().slice(0, 10);

function Card({ card, lead }: { card: BusinessCard; lead?: string }) {
  // Recomputed against today, not trusted from the file: the snapshot is only as
  // fresh as the last deploy, and a wrong day count is worse than none.
  const dias = card.deadline ? daysBetweenIsoDates(todayIso(), card.deadline) : null;
  const state = card.status ?? card.relacion;
  const detail = [card.convocante, card.importe, card.lugar, card.plazas].filter(Boolean).join(' · ');
  return (
    <li>
      <a className="card" href={`${REPO}/${card.path}`} target="_blank" rel="noreferrer">
        <div className="titulo">{card.titulo}</div>
        <div className="chips">
          {lead ? <span className="chip urgent">{lead}</span> : null}
          {state ? <span className="chip">{STATE_LABEL[state] ?? state}</span> : null}
          {card.fit ? <span className="chip">{FIT_LABEL[card.fit]}</span> : null}
          {card.kind === 'propuesta' ? (
            <span className={card.holes === 0 ? 'chip ok' : 'chip'}>
              {card.holes === 0 ? 'sin huecos' : `${String(card.holes)} huecos`}
            </span>
          ) : null}
        </div>
        {detail ? <div className="detail">{detail}</div> : null}
        {dias !== null && !lead ? (
          <div className="detail">
            {dias < 0 ? `plazo vencido hace ${String(-dias)} días` : `quedan ${String(dias)} días`}
          </div>
        ) : null}
      </a>
    </li>
  );
}

function Section({ title, hint, cards, lead }: {
  title: string;
  hint: string;
  cards: BusinessCard[];
  lead?: (card: BusinessCard) => string | undefined;
}) {
  if (cards.length === 0) return null;
  return (
    <section>
      <h2>
        {title} <span className="meta">{cards.length}</span>
      </h2>
      <p className="hint">{hint}</p>
      <ul className="cards">
        {cards.map((card) => (
          <Card key={`${title}-${card.id}`} card={card} lead={lead?.(card)} />
        ))}
      </ul>
    </section>
  );
}

function Dashboard({ snapshot, user }: { snapshot: BusinessSnapshot; user: User }) {
  const age = daysBetweenIsoDates(snapshot.generatedAt, todayIso());
  const urgente = snapshot.urgente
    .map((c) => ({ card: c as BusinessCard, dias: daysBetweenIsoDates(todayIso(), c.deadline ?? snapshot.generatedAt) }))
    .filter((c) => c.dias >= 0)
    .sort((a, b) => a.dias - b.dias);

  return (
    <>
      <header className="bar">
        <h1>Panel · Cultuvilla</h1>
        <button onClick={() => void signOut(auth)}>Salir ({user.email ?? 'sesión'})</button>
      </header>
      <main>
        <p className="meta">
          {age === 0
            ? 'Datos del registro, actualizados hoy.'
            : `Datos del registro, de hace ${String(age)} ${age === 1 ? 'día' : 'días'}.`}
        </p>

        <section>
          <h2>
            Con reloj <span className="meta">{urgente.length}</span>
          </h2>
          <p className="hint">Plazos en los próximos 30 días. Lo único con coste por llegar tarde.</p>
          {urgente.length === 0 ? (
            <p className="meta">Nada vence en los próximos 30 días.</p>
          ) : (
            <ul className="cards">
              {urgente.map(({ card, dias }) => (
                <Card key={`u-${card.id}`} card={card} lead={dias === 0 ? 'hoy' : `${String(dias)} días`} />
              ))}
            </ul>
          )}
        </section>

        <Section
          title="Marcadas listas pero con huecos"
          hint="Creer que una candidatura está terminada es el fallo que más cuesta."
          cards={snapshot.propuestasIncompletas}
        />
        <Section
          title="Plazo vencido sin cerrar"
          hint="Hay que marcarlas como caducadas o avanzarlas."
          cards={snapshot.caducadas}
        />

        {(['propuesta', 'convocatoria', 'evento', 'entidad'] as BusinessKind[]).map((kind) => (
          <Section key={kind} title={KIND_LABEL[kind]} hint={KIND_HINT[kind]} cards={snapshot.byKind[kind]} />
        ))}

        <p className="meta" style={{ marginTop: 32 }}>
          Cada ficha abre su Markdown en GitHub, donde está el razonamiento completo.
        </p>
      </main>
    </>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setReady(true);
  }), []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const call = httpsCallable<undefined, { snapshot: unknown }>(functions, 'getBusinessSnapshot');
      const result = await call();
      // Parsed rather than cast: a shape change should say so, not render as
      // silently missing sections.
      setSnapshot(BusinessSnapshotSchema.parse(result.data.snapshot));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el registro.');
    }
  }, []);

  useEffect(() => {
    if (user) void load();
    else setSnapshot(null);
  }, [user, load]);

  if (missingConfig.length > 0) {
    return (
      <div className="centered">
        <div>
          <h1>Falta configuración</h1>
          <p className="error">Sin {missingConfig.join(', ')}. El build necesita las variables FIREBASE_*_DEV.</p>
        </div>
      </div>
    );
  }

  if (!ready) return <div className="centered">Cargando…</div>;

  if (!user) {
    return (
      <div className="centered">
        <div>
          <h1>Panel · Cultuvilla</h1>
          <p className="meta">Herramienta interna del equipo.</p>
          <button className="primary" onClick={() => void signInWithPopup(auth, googleProvider)}>
            Entrar con Google
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="centered">
        <div>
          <h1>Sin acceso</h1>
          <p className="error">{error}</p>
          <button onClick={() => void signOut(auth)}>Salir</button>
        </div>
      </div>
    );
  }

  if (!snapshot) return <div className="centered">Cargando el registro…</div>;

  return <Dashboard snapshot={snapshot} user={user} />;
}
