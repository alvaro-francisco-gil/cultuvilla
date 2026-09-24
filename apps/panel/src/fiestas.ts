/**
 * The fiesta calendar of the pueblos around Matabuena, shaped for the panel.
 *
 * Fiestas are stored as `MM-DD` recurrences rather than dates, so the panel is
 * the thing that decides what "next" means — same reason deadline day counts are
 * recomputed here instead of trusted from the snapshot. A calendar that quietly
 * shows last year's date is worse than no calendar.
 */
import { nextFiestaOccurrence, daysBetweenIsoDates, type Fiesta, type FiestasDataset, type Pueblo } from '@cultuvilla/shared/models';

export type ProximaFiesta = {
  pueblo: string;
  km: number;
  provincia: string;
  fiesta: Fiesta;
  /** Resolved ISO date of the next occurrence. */
  fecha: string;
  dias: number;
};

export const ANILLO_LABEL: Record<Pueblo['anillo'], string> = {
  referencia: 'Nuestro pueblo',
  '1': 'Anillo 1 · menos de 8 km',
  '2': 'Anillo 2 · 8 a 13 km',
  '3': 'Anillo 3 · 13 a 20 km',
};

const ANILLO_ORDER: Pueblo['anillo'][] = ['referencia', '1', '2', '3'];

/**
 * Every pueblo's fiestas resolved onto their next occurrence, soonest first.
 * @param today ISO date, injected so the output is deterministic in tests.
 */
export function proximasFiestas(dataset: FiestasDataset, today: string, limit?: number): ProximaFiesta[] {
  const all = dataset.pueblos.flatMap((pueblo) =>
    pueblo.fiestas.map((fiesta) => {
      const fecha = nextFiestaOccurrence(fiesta, today);
      return {
        pueblo: pueblo.nombre,
        km: pueblo.km,
        provincia: pueblo.provincia,
        fiesta,
        fecha,
        dias: daysBetweenIsoDates(today, fecha),
      };
    }),
  );
  all.sort((a, b) => (a.fecha === b.fecha ? a.km - b.km : a.fecha.localeCompare(b.fecha)));
  return limit === undefined ? all : all.slice(0, limit);
}

export type AnilloGroup = { anillo: Pueblo['anillo']; pueblos: Pueblo[] };

/**
 * Every open `[[confirmar: …]]` in the dataset, so the panel shows the size of
 * the worklist instead of presenting a half-researched calendar as finished.
 */
export function pendientes(dataset: FiestasDataset): { pueblo: string; marca: string }[] {
  return dataset.pueblos.flatMap((p) => (p.confirmar ?? []).map((marca) => ({ pueblo: p.nombre, marca })));
}

/**
 * Verified fiestas over total — how much of the calendar rests on a real source.
 *
 * `bastante` is false for an empty dataset rather than vacuously true: 0 of 0
 * verified is "we know nothing", which must not render as the same green as
 * "we checked everything".
 */
export function cobertoraVerificada(
  dataset: FiestasDataset,
): { verificadas: number; total: number; bastante: boolean } {
  const all = dataset.pueblos.flatMap((p) => p.fiestas);
  const verificadas = all.filter((f) => f.tipo === 'verificada').length;
  return { verificadas, total: all.length, bastante: all.length > 0 && verificadas * 2 >= all.length };
}

/** Pueblos grouped by ring, nearest ring first and nearest pueblo first inside it. */
export function porAnillo(dataset: FiestasDataset): AnilloGroup[] {
  return ANILLO_ORDER.map((anillo) => ({
    anillo,
    pueblos: dataset.pueblos.filter((p) => p.anillo === anillo).sort((a, b) => a.km - b.km),
  })).filter((group) => group.pueblos.length > 0);
}
