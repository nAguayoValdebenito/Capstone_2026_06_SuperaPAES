// Escenario compartido para comprobar todos los contratos HTTP de ids.
import request from 'supertest';
import type { Express } from 'express';
import { expect, vi } from 'vitest';
import { crearApp, crearServicios } from '../app.js';
import {
  aceptarCualquierSesion,
  crearDependenciasDePrueba,
  tokenAdmin,
  tokenApp,
} from './ayudantes.js';

export const PREFIJO = '/api/v1';

const fecha = new Date('2026-01-01T00:00:00.000Z');
const estudiante = { id: '84', nombre: 'Ana', correo: 'ana@ejemplo.cl', correoVerificado: true };
const usuario = { id: '7', nombre: 'Admin', correo: 'admin@ejemplo.cl', rol: 'admin' as const };
const interno = { ...usuario, activo: true, areas: [1, 2], creadoEn: fecha, ultimoAcceso: null };
const sesion = { tokenAcceso: 'token', tokenRenovacion: 'renovacion' };

export function escenario() {
  const dependencias = crearDependenciasDePrueba();
  const servicios = aceptarCualquierSesion(crearServicios(dependencias));
  const cuentas = {
    ...servicios.cuentas,
    registrarEstudiante: vi.fn(() => Promise.resolve({ ...sesion, estudiante })),
    ingresarEstudiante: vi.fn(() => Promise.resolve({ ...sesion, estudiante })),
    ingresarUsuarioInterno: vi.fn(() => Promise.resolve({ ...sesion, usuario })),
    obtenerUsuarioConsola: vi.fn(() =>
      Promise.resolve({ ...usuario, rol: 'docente' as const, areas: [1, 2] }),
    ),
    documentosLegalesVigentes: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          tipo: 'terminos',
          nombre: 'Términos',
          version: '1.0',
          texto: 'Texto',
          vigenteDesde: fecha,
        },
      ]),
    ),
    buscarEstudiantes: vi.fn(() => Promise.resolve([{ ...estudiante, creadoEn: fecha }])),
    confirmarCorreo: vi.fn(() => Promise.resolve({ ...estudiante, creadoEn: fecha })),
  };
  const administracion = {
    ...servicios.administracion,
    listarUsuariosInternos: vi.fn(() => Promise.resolve([interno])),
    crearUsuarioInterno: vi.fn(() => Promise.resolve(interno)),
    editarUsuarioInterno: vi.fn(() => Promise.resolve(interno)),
    cambiarEstadoUsuarioInterno: vi.fn(() => Promise.resolve(interno)),
  };
  const temario = {
    ...servicios.temario,
    listarAreas: vi.fn(() => Promise.resolve([{ id: 4, nombre: 'Biología' }])),
  };
  const evaluaciones = {
    ...servicios.evaluaciones,
    iniciarPractica: vi.fn(() =>
      Promise.resolve({
        id: '41',
        pruebaId: 2,
        ejeId: 3,
        contenidoId: null,
        habilidadId: null,
        dificultadId: null,
        dificultad: 'mezcla' as const,
        cantidad: 5,
        entregadas: 0,
      }),
    ),
    siguientePregunta: vi.fn(() =>
      Promise.resolve({
        id: '84',
        orden: 1,
        total: 5,
        enunciado: 'Pregunta',
        texto: null,
        alternativas: [
          { id: 101, letra: 'A', texto: 'Primera' },
          { id: '102', letra: 'B', texto: 'Segunda' },
        ],
      }),
    ),
    responderPregunta: vi.fn(() =>
      Promise.resolve({
        esCorrecta: false,
        alternativaElegidaId: '102',
        alternativaCorrectaId: '101',
        explicacion: 'Explicación',
        alternativas: [
          { id: 101, letra: 'A', texto: 'Primera', explicacion: null },
          { id: '102', letra: 'B', texto: 'Segunda', explicacion: null },
        ],
        cupo: { maximo: 10, usadas: 1, restantes: 9, saldoExtra: 0, agotado: false },
      }),
    ),
  };
  const app = crearApp(dependencias, {
    ...servicios,
    cuentas,
    administracion,
    temario,
    evaluaciones,
  });
  return { app, cuentas, administracion, evaluaciones };
}

function valoresDeCampo(valor: unknown, ruta: string): unknown[] {
  const [paso, ...resto] = ruta.split('.');
  if (!paso) return [valor];
  const lista = paso.endsWith('[]');
  const clave = lista ? paso.slice(0, -2) : paso;
  if (typeof valor !== 'object' || valor === null || !(clave in valor)) return [];
  const siguiente: unknown = valor[clave as keyof typeof valor];
  if (lista)
    return Array.isArray(siguiente)
      ? siguiente.flatMap((elemento: unknown) => valoresDeCampo(elemento, resto.join('.')))
      : [];
  return valoresDeCampo(siguiente, resto.join('.'));
}

function cuerpoPara(ruta: string): Record<string, unknown> | undefined {
  if (ruta.endsWith('/registro'))
    return {
      nombre: 'Ana',
      correo: 'ana@ejemplo.cl',
      contrasena: 'Clave-larga-123',
      declaraTenerCatorceAnios: true,
      documentosAceptados: [1, 2],
    };
  if (ruta.endsWith('/ingreso'))
    return {
      correo: 'ana@ejemplo.cl',
      contrasena: 'Clave-larga-123',
    };
  if (ruta.endsWith('/usuarios-internos') && ruta.startsWith('POST'))
    return {
      nombre: 'Diego',
      correo: 'diego@ejemplo.cl',
      rol: 'docente',
      areas: [1, 2],
      contrasena: 'Clave-larga-123',
    };
  if (ruta.startsWith('PATCH')) return { nombre: 'Diego Nuevo' };
  if (ruta.endsWith('/practicas')) return { pruebaId: 2, cantidad: 5 };
  if (ruta.endsWith('/respuesta')) return { alternativaId: 102 };
  return undefined;
}

export async function consultarContrato(app: Express, contrato: string) {
  const [metodo, patron] = contrato.split(' ');
  if (!patron) throw new Error('Falta ruta en el contrato de IDs.');
  const ruta = patron
    .replace(
      ':id',
      patron.includes('/estudiantes/') ? '84' : patron.includes('/evaluaciones/') ? '41' : '7',
    )
    .replace(':item', '84');
  const peticion =
    metodo === 'GET'
      ? request(app).get(ruta)
      : metodo === 'PATCH'
        ? request(app).patch(ruta)
        : request(app).post(ruta);
  if (ruta.startsWith(`${PREFIJO}/admin/`))
    peticion.set({ Authorization: `Bearer ${await tokenAdmin()}` });
  if (ruta.startsWith(`${PREFIJO}/app/evaluaciones/`))
    peticion.set({ Authorization: `Bearer ${await tokenApp()}` });
  if (ruta.endsWith('/estudiantes')) peticion.query({ correo: 'ana@ejemplo.cl' });
  const cuerpo = cuerpoPara(contrato);
  if (cuerpo) peticion.send(cuerpo);
  return peticion;
}

export function comprobarCampos(cuerpo: unknown, campos: readonly string[]): void {
  for (const campo of campos) {
    const valores = valoresDeCampo(cuerpo, campo);
    expect(valores.length, campo).toBeGreaterThan(0);
    for (const valor of valores) {
      if (valor === null) continue;
      expect(typeof valor, campo).toBe('number');
      expect(Number.isSafeInteger(valor), campo).toBe(true);
      expect(valor as number, campo).toBeGreaterThan(0);
    }
  }
}
