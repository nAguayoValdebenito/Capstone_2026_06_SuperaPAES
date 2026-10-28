// Escenario compartido para comprobar todos los contratos HTTP de ids.
import request from 'supertest';
import type { Express } from 'express';
import { expect, vi } from 'vitest';
import { crearApp, crearServicios } from '../app.js';
import {
  cuerpoPregunta,
  filtrosBanco,
  paginaBanco,
  preguntaParaEditar,
} from './escenario-ids-preguntas.js';
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
const resumenPractica = {
  id: '41',
  prueba: { id: 2, codigo: 'M1', nombre: 'Matemática 1' },
  alcance: { tipo: 'eje' as const, id: 3, nombre: 'Álgebra' },
  dificultad: { id: null, codigo: 'mezcla', nombre: 'Mezcla' },
  cantidad: 5,
  respondidas: 5,
  correctas: 4,
  incorrectas: 1,
  omitidas: 0,
  porcentaje: 80,
  tiempoUsadoSeg: 300,
  ejes: [{ id: 3, nombre: 'Álgebra', preguntas: 5, correctas: 4 }],
  habilidades: [{ id: 6, nombre: 'Resolver problemas', preguntas: 5, correctas: 4 }],
};

const perfil = {
  completo: true,
  curso: { codigo: '3M', nombre: '3° medio' },
  anioEgreso: 2027,
  pruebas: [1, 2, 5],
  electivoId: 4,
  pruebaReforzarId: 2,
  areasCarrera: [1],
  debeConfirmarCurso: false,
};
const opcionesPerfil = {
  cursos: [{ codigo: '3M', nombre: '3° medio' }],
  pruebas: [
    { id: 5, codigo: 'CIE', nombre: 'Ciencias', electivos: [{ id: 4, nombre: 'Biología' }] },
  ],
  areasCarrera: [
    { id: 1, codigo: 'salud', nombre: 'Salud', pruebasSugeridas: [1, 2, 5], electivoSugeridoId: 4 },
  ],
};

/** Progreso de HU-38.2 con un eje, una habilidad y un ensayo, para que cada id tenga valores. */
const grupoProgreso = {
  respondidas: 10,
  correctas: 5,
  aciertoPonderado: 45.7,
  aciertoPorDificultad: { media: 80, dificil: 20 },
  aReforzar: true,
};
const progreso = {
  pruebas: [
    {
      pruebaId: 2,
      codigo: 'M1',
      nombre: 'Competencia Matemática 1',
      respondidas: 10,
      correctas: 5,
      acierto: 50,
      aciertoPonderado: 45.7,
      aciertoPorDificultad: { media: 80, dificil: 20 },
      ejes: [{ id: 3, nombre: 'Números', ...grupoProgreso }],
      habilidades: [{ id: 7, nombre: 'Resolver problemas', ...grupoProgreso }],
      semanas: [{ semana: '2026-10-26', respondidas: 10, acierto: 50 }],
      ensayos: [{ id: '41', cerradaEn: fecha, puntaje: 650 }],
    },
  ],
};

const opcionesPractica = {
  dificultades: [{ id: 1, codigo: 'facil', nombre: 'Fácil', mezcla: 30 }],
  pruebas: [
    {
      id: 3,
      codigo: 'M2',
      nombre: 'Competencia Matemática 2',
      ejes: [{ id: 9, nombre: 'Números', contenidos: [{ id: 120, nombre: 'Logaritmos' }] }],
      habilidades: [{ id: 14, nombre: 'Resolver problemas' }],
    },
  ],
};

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
    obtenerPerfil: vi.fn(() => Promise.resolve(perfil)),
    guardarPerfil: vi.fn(() => Promise.resolve(perfil)),
    confirmarCurso: vi.fn(() => Promise.resolve(perfil)),
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
    opcionesPerfil: vi.fn(() => Promise.resolve(opcionesPerfil)),
    opcionesPractica: vi.fn(() => Promise.resolve(opcionesPractica)),
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
    cerrarPractica: vi.fn(() => Promise.resolve(resumenPractica)),
    resumenPractica: vi.fn(() => Promise.resolve(resumenPractica)),
    obtenerProgreso: vi.fn(() => Promise.resolve(progreso)),
  };
  const preguntas = {
    ...servicios.preguntas,
    listarBanco: vi.fn(() => Promise.resolve(paginaBanco)),
    filtrosDelBanco: vi.fn(() => Promise.resolve(filtrosBanco)),
    crearPregunta: vi.fn(() => Promise.resolve(preguntaParaEditar)),
    obtenerPregunta: vi.fn(() => Promise.resolve(preguntaParaEditar)),
    editarPregunta: vi.fn(() => Promise.resolve(preguntaParaEditar)),
  };
  const app = crearApp(dependencias, {
    ...servicios,
    cuentas,
    administracion,
    temario,
    preguntas,
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
  if (/^(POST|PUT) .*\/preguntas\/(:id)?$/.test(ruta)) return cuerpoPregunta;
  return cuerpoPerfil(ruta);
}

/** Perfil del estudiante (HU-29.1): guardar todo el perfil o confirmar el curso. */
function cuerpoPerfil(ruta: string): Record<string, unknown> | undefined {
  if (ruta.startsWith('PUT') && ruta.endsWith('/perfil'))
    return { curso: '3M', pruebas: [1, 2, 5], electivoId: 4, pruebaReforzarId: 2 };
  if (ruta.endsWith('/confirmar-curso')) return { curso: '3M' };
  return undefined;
}

const METODOS = { GET: 'get', PATCH: 'patch', PUT: 'put', POST: 'post' } as const;

/** Consulta (?…) que exige cada ruta, por su último tramo. */
const CONSULTAS: Record<string, Record<string, string>> = {
  '/estudiantes': { correo: 'ana@ejemplo.cl' },
  '/opciones-practica': { curso: '3M' },
};

/** Rutas de la app que exigen la sesión del estudiante. */
const CON_SESION_APP = ['/app/evaluaciones/', '/app/temario/', '/app/cuentas/perfil'];

async function sesionPara(ruta: string): Promise<Record<string, string>> {
  if (ruta.startsWith(`${PREFIJO}/admin/`))
    return { Authorization: `Bearer ${await tokenAdmin()}` };
  if (CON_SESION_APP.some((prefijo) => ruta.startsWith(`${PREFIJO}${prefijo}`)))
    return { Authorization: `Bearer ${await tokenApp()}` };
  return {};
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
  const peticion = request(app)[METODOS[metodo as keyof typeof METODOS]](ruta);
  peticion.set(await sesionPara(ruta));
  const consulta = CONSULTAS[ruta.slice(ruta.lastIndexOf('/'))];
  if (consulta) peticion.query(consulta);
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
