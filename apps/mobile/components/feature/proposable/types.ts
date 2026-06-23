/**
 * Proposable managers (Places/Barrios/Organizations) render in one of two
 * modes:
 * - `create`: just the "Añadir X" form, shown on the dedicated create screen.
 * - `manage`: the moderation list (approve/reject/edit/delete), shown inside the
 *   admin-only community ("Editar pueblo") screen.
 */
export type ManagerMode = 'create' | 'manage';
