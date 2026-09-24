import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CardRow } from './components';
import { CalendarView } from './CalendarView';
import { FiestasView } from './FiestasView';

// Hardcoded Spanish: two users, no localisation need.
const KIND_LABEL: Record<BusinessKind, string> = {
  propuesta: 'Propuestas',
  convocatoria: 'Convocatorias',
  evento: 'Encuentros',
  entidad: 'Entidades',
  busqueda: 'Búsquedas',
};

const KIND_HINT: Record<BusinessKind, string> = {
  propuesta: 'Candidaturas que estamos escribiendo',
  convocatoria: 'Dinero que podríamos conseguir',
  evento: 'Salas en las que conviene estar',
  entidad: 'Financiadores, colaboradores, administraciones',
  busqueda: 'Qué se ha buscado ya, qué se descartó, y cuándo toca repetirlo',
};

/** `propuesta` has its own tab, so the registry tab lists the other three. */
const REGISTRO_KINDS: BusinessKind[] = ['convocatoria', 'evento', 'entidad', 'busqueda'];
const KIND_ORDER: BusinessKind[] = ['propuesta', ...REGISTRO_KINDS];

/**
 * Top-level tabs. `Lista`/`Calendario` inside the registry tab is a *view* of
 * the same records; these are different bodies of work, which is why they are a
 * separate control rather than four more buttons in the same group.
 */
const TABS = { registro: 'Registro', propuestas: 'Propuestas', fiestas: 'Fiestas' } as const;
type Tab = keyof typeof TABS;
const isTab = (value: string): value is Tab => value in TABS;

/** The tab lives in the hash so a reload, or a link to a founder, keeps it. */
function useHashTab(): [Tab, (tab: Tab) => void] {
  const read = (): Tab => {
    const raw = window.location.hash.replace(/^#/, '');
    return isTab(raw) ? raw : 'registro';
  };
  const [tab, setTab] = useState<Tab>(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return [
    tab,
    (next: Tab) => {
      window.location.hash = next;
      setTab(next);
    },
  ];
}
const todayIso = (): string => new Date().toISOString().slice(0, 10);

function Section({ title, hint, cards, today }: {
  title: string;
  hint: string;
  cards: BusinessCard[];
  today: string;
}) {
  if (cards.length === 0) return null;
  return (
    <section>
      <div className="sectionhead">
        <h2>{title}</h2>
        <span className="count">{cards.length}</span>
      </div>
      <p className="hint">{hint}</p>
      <ul className="cards">
        {cards.map((card) => (
          <CardRow
            key={`${title}-${card.id}`}
            card={card}
            dias={(() => {
              // A sweep's clock is its review date; everything else runs on a deadline.
              const when = card.kind === 'busqueda' ? card.revisar : card.deadline;
              return when ? daysBetweenIsoDates(today, when) : null;
            })()}
          />
        ))}
      </ul>
    </section>
  );
}

function Dashboard({ snapshot, user }: { snapshot: BusinessSnapshot; user: User }) {
  const [tab, setTab] = useHashTab();
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const today = todayIso();
  const age = daysBetweenIsoDates(snapshot.generatedAt, today);

  const allCards = useMemo(
    () => KIND_ORDER.flatMap((kind) => snapshot.byKind[kind]),
    [snapshot],
  );

  // Recomputed against today rather than trusted from the file: the snapshot is
  // only as fresh as the last deploy, and a wrong day count is worse than none.
  const urgente = useMemo(
    () =>
      snapshot.urgente
        .map((card) => ({ card: card as BusinessCard, dias: daysBetweenIsoDates(today, card.deadline ?? today) }))
        .filter(({ dias }) => dias >= 0)
        .sort((a, b) => a.dias - b.dias),
    [snapshot, today],
  );

  return (
    <>
      <header className="bar">
        <h1>Panel · Cultuvilla</h1>
        <div className="tabs" role="group" aria-label="Sección">
          {(Object.keys(TABS) as Tab[]).map((key) => (
            <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
              {TABS[key]}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" onClick={() => void signOut(auth)}>
          Salir
        </button>
      </header>

      <main>
        <p className="meta">
          {age === 0 ? 'Registro actualizado hoy.' : `Registro de hace ${String(age)} ${age === 1 ? 'día' : 'días'}.`}
          {' · '}
          {user.email ?? 'sesión activa'}
        </p>

        {tab === 'fiestas' ? (
          snapshot.fiestas ? (
            <FiestasView dataset={snapshot.fiestas} today={today} />
          ) : (
            <p className="meta">
              El registro no trae el dataset de pueblos. Falta
              project/mercado/pueblos-vecinos-matabuena.json.
            </p>
          )
        ) : tab === 'propuestas' ? (
          <>
            <Section
              title="Marcadas listas pero con huecos"
              hint="Creer que una candidatura está terminada es el fallo que más cuesta."
              cards={snapshot.propuestasIncompletas}
              today={today}
            />
            <Section
              title="Propuestas"
              hint={KIND_HINT.propuesta}
              cards={snapshot.byKind.propuesta}
              today={today}
            />
            {snapshot.byKind.propuesta.length === 0 ? (
              <p className="meta">Ninguna candidatura en marcha.</p>
            ) : null}
          </>
        ) : (
          <>
            <div className="tabs inline" role="group" aria-label="Vista">
              <button type="button" aria-pressed={view === 'lista'} onClick={() => setView('lista')}>
                Lista
              </button>
              <button type="button" aria-pressed={view === 'calendario'} onClick={() => setView('calendario')}>
                Calendario
              </button>
            </div>

            {view === 'calendario' ? (
              <section>
                <div className="sectionhead">
                  <h2>Próximos tres meses</h2>
                </div>
                <p className="hint">Solo los días con algo. Un mes vacío significa que no vence nada.</p>
                <CalendarView cards={allCards} today={today} />
              </section>
            ) : (
              <>
                <section>
                  <div className="sectionhead">
                    <h2>Con reloj</h2>
                    <span className="count">{urgente.length}</span>
                  </div>
                  <p className="hint">Plazos en los próximos 30 días. Lo único con coste por llegar tarde.</p>
                  {urgente.length === 0 ? (
                    <p className="meta">Nada vence en los próximos 30 días.</p>
                  ) : (
                    <ul className="cards">
                      {urgente.map(({ card, dias }) => (
                        <CardRow key={`u-${card.id}`} card={card} dias={dias} />
                      ))}
                    </ul>
                  )}
                </section>

                <Section
                  title="Plazo vencido sin cerrar"
                  hint="Hay que marcarlas como caducadas o avanzarlas."
                  cards={snapshot.caducadas}
                  today={today}
                />

                {REGISTRO_KINDS.map((kind) => (
                  <Section
                    key={kind}
                    title={KIND_LABEL[kind]}
                    hint={KIND_HINT[kind]}
                    cards={snapshot.byKind[kind]}
                    today={today}
                  />
                ))}
              </>
            )}
          </>
        )}

        {tab === 'fiestas' ? null : (
          <p className="hint" style={{ marginTop: 32 }}>
            Cada ficha abre su Markdown en GitHub, donde está el razonamiento completo.
          </p>
        )}
      </main>
    </>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next);
    setReady(true);
  }), []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const call = httpsCallable<undefined, { snapshot: unknown }>(functions, 'getBusinessSnapshot');
      const result = await call();
      // Parsed, not cast: a shape change should say so, not render as silently
      // missing sections.
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
          <p className="error">Sin {missingConfig.join(', ')}.</p>
          <p className="hint">El build necesita las variables FIREBASE_*_DEV de apps/mobile/.env.</p>
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
          <p className="hint">Herramienta interna del equipo.</p>
          <button type="button" className="primary" onClick={() => void signInWithPopup(auth, googleProvider)}>
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
          <p className="hint">Hace falta un documento en admins/ del proyecto dev.</p>
          <button type="button" onClick={() => void signOut(auth)}>Salir</button>
        </div>
      </div>
    );
  }

  if (!snapshot) return <div className="centered">Cargando el registro…</div>;

  return <Dashboard snapshot={snapshot} user={user} />;
}
