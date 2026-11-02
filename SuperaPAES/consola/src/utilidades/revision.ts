// Formatos de la revisión docente (D01, HU-22): el código de la pregunta y la fecha límite.

const fechaCorta = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short' });

/** «P-0244», como en el boceto D01. */
export const codigoDePregunta = (id: number) => `P-${String(id).padStart(4, '0')}`;

/** La fecha límite de la revisión, en formato corto de Chile. */
export const fechaLimite = (venceEn: string) => fechaCorta.format(new Date(venceEn));
