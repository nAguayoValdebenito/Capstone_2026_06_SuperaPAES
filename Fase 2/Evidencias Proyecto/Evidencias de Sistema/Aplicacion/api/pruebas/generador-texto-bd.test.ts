// HU-18.1 y HU-18.2, CU-17, contra PostgreSQL real y con un proveedor de IA falso: en Competencia Lectora el worker
// pide primero el texto de lectura y después una pregunta por ficha apoyada en él (Localizar, Interpretar y Evaluar).
// El texto y sus preguntas se guardan juntos al final, en una sola transacción: si el proceso muere antes, no
// queda un texto huérfano ni preguntas sueltas, y el siguiente turno empieza de nuevo con un texto propio.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SolicitudGeneracion } from '../adaptadores/ia/proveedor.js';
import { ErrorIANoDisponible } from '../comun/errores.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador } from './generador-bd.js';
import { propuestaValida, resultadoDeTexto, resultadoValido, textoValido } from './ia-falsa.js';

const esTexto = (s: SolicitudGeneracion) => s.salida === 'texto';
const conCambios = (cambios: Record<string, unknown>) => (s: SolicitudGeneracion, n: number) => ({
  ...resultadoValido(s, n),
  preguntas: [{ ...propuestaValida(s, n), ...cambios }],
});
const textoCon = (cambios: Record<string, unknown>) => (_s: SolicitudGeneracion, n: number) => ({
  ...resultadoDeTexto(n),
  texto: { ...textoValido(n), ...cambios },
});

exigirBaseEnCi();
describe.skipIf(!urlBase)('lote con texto de lectura con PostgreSQL (HU-18)', () => {
  const g = prepararGenerador('texto');
  const { entorno, ia } = g;

  let sesion: ReturnType<typeof g.sesionAdmin> | undefined;
  beforeEach(() => {
    sesion = undefined;
  });

  async function pedir(cantidad: number): Promise<number> {
    sesion ??= g.sesionAdmin();
    const respuesta = await g.pedirLote(await sesion, {
      contenidoId: g.contenidos.cl,
      cantidad,
      conTexto: true,
    });
    expect(respuesta.status).toBe(202);
    return respuesta.body.data.id as number;
  }

  const textosDelLote = async (id: number) =>
    (
      await entorno.bd.query<Record<string, unknown>>(
        `SELECT t.id::text AS id, t.titulo, t.contenido, t.lote_id::int AS lote_id, t.creado_por, tt.codigo AS tipo
           FROM contenido.texto_estimulo t JOIN contenido.tipo_texto tt ON tt.id = t.tipo_texto_id
          WHERE t.lote_id = $1`,
        [id],
      )
    ).rows;

  const preguntasDelLote = async (id: number) =>
    (
      await entorno.bd.query<Record<string, unknown>>(
        `SELECT p.id::text AS id, p.texto_estimulo_id::text AS texto_id, p.orden_en_texto, h.codigo AS habilidad,
                e.codigo AS estado, (SELECT COUNT(*)::int FROM contenido.alternativa a WHERE a.pregunta_id = p.id) AS alternativas
           FROM contenido.pregunta p
           JOIN contenido.habilidad h ON h.id = p.habilidad_id
           JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
          WHERE p.lote_id = $1 ORDER BY p.orden_en_texto`,
        [id],
      )
    ).rows;

  it('pide primero el texto y después una pregunta por ficha, apoyada en ese texto', async () => {
    await pedir(3);

    await g.trabajador().procesarPendientes();

    expect(ia.llamadas).toHaveLength(4);
    expect(esTexto(ia.llamadas[0]!)).toBe(true);
    const titulo = textoValido(1).titulo;
    for (const pregunta of ia.llamadas.slice(1)) {
      expect(esTexto(pregunta)).toBe(false);
      expect(pregunta.instruccion).toMatch(/<<<TEXTO\nTítulo: La ciudad y el río, caso 1\n/u);
      expect(pregunta.instruccion).toContain(titulo);
    }
  });

  it('guarda el texto con su lote y las preguntas enlazadas a él, en orden, como borrador', async () => {
    const id = await pedir(3);

    await g.trabajador().procesarPendientes();

    const [texto, ...otros] = await textosDelLote(id);
    expect(otros).toHaveLength(0);
    expect(texto).toMatchObject({ tipo: 'no_literario', lote_id: id, creado_por: null });
    expect(String(texto?.['contenido']).length).toBeGreaterThan(600);
    const preguntas = await preguntasDelLote(id);
    expect(preguntas.map((p) => p['orden_en_texto'])).toEqual([1, 2, 3]);
    expect(preguntas.every((p) => p['texto_id'] === texto?.['id'])).toBe(true);
    expect(preguntas.every((p) => p['estado'] === 'borrador' && p['alternativas'] === 4)).toBe(
      true,
    );
    expect(await g.filaDeLote(id)).toMatchObject({
      estado: 'completado',
      validas: 3,
      descartadas: 0,
    });
  });

  it('las tres preguntas cubren Localizar, Interpretar y Evaluar', async () => {
    const id = await pedir(3);

    await g.trabajador().procesarPendientes();

    const habilidades = (await preguntasDelLote(id)).map((p) => p['habilidad']);
    expect([...habilidades].sort()).toEqual(['EVA', 'INT', 'LOC']);
  });

  it('suma al lote los tokens y el costo del texto además de los de las preguntas', async () => {
    const id = await pedir(3);

    await g.trabajador().procesarPendientes();

    const fila = await g.filaDeLote(id);
    expect(fila['tokens_usados']).toBe(1400 + 3 * 900);
    // Texto: 500 × 0,30 + 900 × 1,20 por millón = 0,00123 → 0,0013. Preguntas: 0,0009 cada una.
    expect(Number(fila['costo_usd'])).toBeCloseTo(0.0013 + 3 * 0.0009, 4);
  });

  describe('si el proceso muere a mitad del lote', () => {
    it('no deja texto ni preguntas guardados, y el siguiente turno parte de cero con un solo texto', async () => {
      const id = await pedir(3);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      ia.encolar(
        (_s, n) => resultadoDeTexto(n),
        (s, n) => resultadoValido(s, n),
        (s, n) => resultadoValido(s, n),
        new Error('el proceso murió'),
      );

      await g.trabajador().procesarPendientes();

      expect(await textosDelLote(id)).toHaveLength(0);
      expect(await preguntasDelLote(id)).toHaveLength(0);
      const quedo = await g.filaDeLote(id);
      expect(quedo).toMatchObject({ estado: 'pendiente', validas: 0, descartadas: 0 });
      // El gasto de las llamadas que sí se hicieron queda anotado: es dinero real.
      expect(quedo['tokens_usados']).toBe(1400 + 900 + 900);

      await g.trabajador().procesarPendientes();

      expect(await textosDelLote(id)).toHaveLength(1);
      expect(await preguntasDelLote(id)).toHaveLength(3);
      expect(await g.filaDeLote(id)).toMatchObject({ estado: 'completado', validas: 3 });
    });
  });

  describe('revisión del texto (HU-18.2)', () => {
    it('un texto inválido se vuelve a pedir y el lote sigue con el siguiente', async () => {
      const id = await pedir(3);
      ia.encolar(textoCon({ contenido: 'Muy corto.' }));

      await g.trabajador().procesarPendientes();

      expect(ia.llamadas.filter(esTexto)).toHaveLength(2);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'completado', validas: 3 });
      expect(fila['motivos_descarte']).toMatchObject({ textos: { texto_corto: 1 } });
    });

    it('si los 3 intentos del texto fallan, el lote queda fallido sin pedir ninguna pregunta', async () => {
      const id = await pedir(3);
      const mal = textoCon({ contenido: 'Muy corto.' });
      ia.encolar(mal, mal, mal);

      await g.trabajador().procesarPendientes();

      expect(ia.llamadas).toHaveLength(3);
      expect(ia.llamadas.every(esTexto)).toBe(true);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'fallido', validas: 0, descartadas: 0 });
      expect(fila['motivos_descarte']).toMatchObject({
        textos: { texto_corto: 3 },
        cierre: 'texto_invalido',
      });
      expect(await textosDelLote(id)).toHaveLength(0);
    });

    it('si la IA falla 3 veces al pedir el texto, cierra el lote sin pedir preguntas', async () => {
      const id = await pedir(3);
      ia.encolar(new ErrorIANoDisponible(), new ErrorIANoDisponible(), new ErrorIANoDisponible());

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas).toHaveBeenCalledTimes(3);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'fallido', validas: 0 });
      expect(fila['motivos_descarte']).toMatchObject({
        fallas: { IA_NO_DISPONIBLE: 3 },
        cierre: 'ia_no_disponible',
      });
    });
  });

  describe('revisión de las preguntas del texto', () => {
    it('una pregunta descartada no se guarda y las demás conservan el orden dentro del texto', async () => {
      const id = await pedir(3);
      ia.encolar(undefined as never, conCambios({ habilidad: 'XX' }));

      await g.trabajador().procesarPendientes();

      const preguntas = await preguntasDelLote(id);
      expect(preguntas.map((p) => p['orden_en_texto'])).toEqual([1, 2]);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'completado', validas: 2, descartadas: 1 });
      expect(fila['motivos_descarte']).toMatchObject({ porMotivo: { habilidad_invalida: 1 } });
    });

    it('si ninguna pregunta es válida, el lote falla y no queda el texto guardado', async () => {
      const id = await pedir(3);
      const mala = conCambios({ habilidad: 'XX' });
      ia.encolar(undefined as never, mala, mala, mala);

      await g.trabajador().procesarPendientes();

      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'fallido', validas: 0, descartadas: 3 });
      expect(await textosDelLote(id)).toHaveLength(0);
      expect(await preguntasDelLote(id)).toHaveLength(0);
    });
  });

  it('con el tope mensual alcanzado a mitad, guarda el texto con las preguntas que ya hizo', async () => {
    const id = await pedir(6);
    await g.parametro('tope_mensual_ia_usd', 0.004);

    await g.trabajador().procesarPendientes();

    // Texto 0,0013 + 3 preguntas de 0,0009 = 0,004: el tope se alcanza tras la tercera.
    const fila = await g.filaDeLote(id);
    expect(fila).toMatchObject({ estado: 'completado', validas: 3 });
    expect(fila['motivos_descarte']).toMatchObject({ cierre: 'tope_mensual' });
    expect(await textosDelLote(id)).toHaveLength(1);
    expect(await preguntasDelLote(id)).toHaveLength(3);
  });
});
