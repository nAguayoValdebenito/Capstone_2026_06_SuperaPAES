// Fechas de C13 en la hora de Chile, con el año completo (20-10-2026, como el boceto).
const fecha = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Santiago',
});

export const fechaCorta = (iso: string): string => fecha.format(new Date(iso));
