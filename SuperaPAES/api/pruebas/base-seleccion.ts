import path from 'node:path';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { ejecutarSemillas } from '../db/semillas.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import { crearEvaluacionesRepositorio } from '../modulos/evaluaciones/evaluaciones.repositorio.js';
import { crearSeleccionPractica } from '../modulos/evaluaciones/evaluaciones.seleccion.servicio.js';
import type {
  DatosSeleccion,
  PreguntaSeleccionada,
} from '../modulos/evaluaciones/evaluaciones.seleccion.tipos.js';
import { crearBaseTemporal, type BaseTemporal, MINUTO, vaciarTablas } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';

export const AHORA_SELECCION = new Date('2026-10-25T15:00:00Z');

export function prepararSeleccion(prefijo: string) {
  let base: BaseTemporal;
  beforeAll(async () => {
    base = await crearBaseTemporal(prefijo);
    await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
    await base.bd.query(`INSERT INTO contenido.prueba_tipo_pregunta
      SELECT p.id, t.id FROM contenido.prueba p, contenido.tipo_pregunta t
      WHERE t.codigo = 'seleccion_multiple' ON CONFLICT DO NOTHING`);
    await base.bd.query(
      `CREATE TEMP TABLE niveles_originales AS SELECT id, nivel_escolar_id, eje_id FROM contenido.contenido_tematico`,
    );
  }, MINUTO);
  afterAll(async () => {
    await base?.cerrar();
  });
  beforeEach(async () => {
    await vaciarTablas(base.bd, [
      'app.estudiante',
      'contenido.pregunta',
      'contenido.texto_estimulo',
    ]);
    await base.bd.query(
      `UPDATE contenido.contenido_tematico c SET nivel_escolar_id=n.nivel_escolar_id, eje_id=n.eje_id FROM niveles_originales n WHERE c.id=n.id`,
    );
  });
  return {
    get bd() {
      return base.bd;
    },
    servicio(azar = () => 0) {
      return crearSeleccionPractica({
        repositorio: crearEvaluacionesRepositorio(base.bd),
        reloj: () => AHORA_SELECCION,
        azar,
        administracion: crearAdministracionServicio({
          bd: base.bd,
          unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(base.bd, trabajo) },
          revocarSesionesUsuarioInterno: () => Promise.resolve(),
        }),
      });
    },
    async datos(prueba = 'M1', cantidad = 20, egreso = 2028): Promise<DatosSeleccion> {
      const estudianteId = await crearEstudianteDePrueba(base.bd, {
        correo: `seleccion${Date.now()}@ejemplo.cl`,
        contrasena: 'frase de prueba distinta',
      });
      await base.bd.query('UPDATE app.estudiante SET anio_egreso = $2 WHERE id = $1', [
        estudianteId,
        egreso,
      ]);
      const {
        rows: [fila],
      } = await base.bd.query<{ id: number }>('SELECT id FROM contenido.prueba WHERE codigo = $1', [
        prueba,
      ]);
      if (!fila) throw new Error('Falta la prueba.');
      return {
        estudianteId,
        pruebaId: fila.id,
        cantidad,
        iniciadaEn: AHORA_SELECCION,
        entregadas: [],
      };
    },
  };
}

export async function seleccionarTodas(
  servicio: ReturnType<ReturnType<typeof prepararSeleccion>['servicio']>,
  datos: DatosSeleccion,
): Promise<PreguntaSeleccionada[]> {
  const entregadas: PreguntaSeleccionada[] = [...datos.entregadas];
  for (let orden = entregadas.length; orden < datos.cantidad; orden++) {
    const siguiente = await servicio.elegirSiguiente({ ...datos, entregadas });
    if (!siguiente) break;
    entregadas.push(siguiente);
  }
  return entregadas;
}
