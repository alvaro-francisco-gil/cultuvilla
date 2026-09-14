/**
 * Every string that appears on a Wrapped image. Server-rendered templates in
 * this repo keep their Spanish as module constants (see the registration email
 * template) because `@cultuvilla/i18n` is not consumed server-side; keeping all
 * of it in one file is what makes it findable when it is.
 *
 * The verbs are deliberate: every figure is a SIGN-UP. `checkedInAt` is never
 * set, so nothing here may say "asistieron".
 */
export const copy = {
  brand: 'Cultuvilla',
  fiestas: 'Fiestas',
  fiestasYear: (year: number) => `Fiestas ${String(year)}`,
  peopleKicker: 'Todo el pueblo',
  peopleTitle: (n: number) => `${String(n)} vecinos`,
  peopleSubtitle: (n: number) => `${String(n)} se apuntaron a algo`,
  peopleLegendIn: 'Se apuntó',
  peopleLegendOut: 'Aún no',
  eventsKicker: 'Lo que se hizo',
  eventsTitle: (n: number) => (n === 1 ? '1 evento' : `${String(n)} eventos`),
  eventsMore: (n: number) => `y ${String(n)} más`,
  organizersKicker: 'Quién lo hizo posible',
  organizersTitle: 'Gracias',
  organizersOrgs: 'Asociaciones y peñas',
  organizersPeople: 'Organizaron',
  eventCount: (n: number) => (n === 1 ? '1 evento' : `${String(n)} eventos`),
  postersKicker: 'El archivo del pueblo',
  postersTitle: (span: number) => (span > 0 ? `${String(span)} años de carteles` : 'Los carteles'),
  postersAdded: (n: number) =>
    n === 0 ? 'Este año aún no se ha sumado ninguno' : n === 1 ? 'Este año se sumó 1' : `Este año se sumaron ${String(n)}`,
  statsKicker: 'En números',
  statsEvents: 'eventos',
  statsPeople: 'personas se apuntaron',
  statsSignups: 'inscripciones',
  statsComments: 'comentarios',
  statsWaitlist: 'en lista de espera',
  statsFullest: 'El evento más lleno',
  statsFullestCount: (n: number, cap: number | null) =>
    cap ? `${String(n)} de ${String(cap)} plazas` : `${String(n)} apuntados`,
};
