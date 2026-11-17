// Entorno compartido de las pruebas del perfil con PostgreSQL real (HU-29.1 y HU-29.3): la base de
// sesiones con las semillas (pruebas, áreas y áreas de carrera), los ids de la base temporal y las
// llamadas a las rutas del perfil a una hora del reloj de la app.
import path from 'node:path';
import request from 'supertest';
import { beforeAll } from 'vitest';
import { ejecutarSemillas } from '../db/semillas.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { estudianteConSesion } from './verificacion-de-prueba.js';

export const RUTA_OPCIONES = '/api/v1/app/temario/opciones-perfil';
export const RUTA_PERFIL = '/api/v1/app/cuentas/perfil';
export const RUTA_CONFIRMAR = '/api/v1/app/cuentas/perfil/confirmar-curso';

/** Registra los ganchos del describe que lo llama. */
export function prepararPerfil(prefijo: string) {
  const entorno = usarBaseDeSesiones(prefijo);
  const ids = { pruebas: new Map<string, number>(), areas: new Map<string, number>() };

  beforeAll(async () => {
    await ejecutarSemillas(entorno.bd, path.join(import.meta.dirname, '../db/semillas'));
    const pruebas = await entorno.bd.query<{ id: number; codigo: string }>(
      'SELECT id, codigo FROM contenido.prueba',
    );
    for (const { id, codigo } of pruebas.rows) ids.pruebas.set(codigo, id);
    const areas = await entorno.bd.query<{ id: number; nombre: string }>(
      'SELECT id, nombre FROM contenido.area',
    );
    for (const { id, nombre } of areas.rows) ids.areas.set(nombre, id);
  });

  const prueba = (codigo: string) => ids.pruebas.get(codigo) ?? 0;
  const area = (nombre: string) => ids.areas.get(nombre) ?? 0;

  return {
    entorno,
    prueba,
    area,
    /** Estudiante con sesión abierta a la hora indicada del reloj de la app. */
    estudianteA: (hora: Date) => {
      entorno.fijarHora(hora);
      return estudianteConSesion(entorno);
    },
    perfilDe: (sesion: Record<string, string>) => request(entorno.app).get(RUTA_PERFIL).set(sesion),
    guardar: (sesion: Record<string, string>, cuerpo: Record<string, unknown>) =>
      request(entorno.app).put(RUTA_PERFIL).set(sesion).send(cuerpo),
    confirmar: (sesion: Record<string, string>, cuerpo: Record<string, unknown>) =>
      request(entorno.app).post(RUTA_CONFIRMAR).set(sesion).send(cuerpo),
    /** Un perfil completo que rinde Lectora, M1 y Ciencias con Biología, en el curso indicado. */
    perfilSalud: (curso = '3M') => ({
      curso,
      pruebas: [prueba('CL'), prueba('M1'), prueba('CIE')],
      electivoId: area('Biología'),
      pruebaReforzarId: prueba('M1'),
      areasCarrera: [1],
    }),
  };
}
