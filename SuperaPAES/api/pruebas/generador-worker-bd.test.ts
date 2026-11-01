// HU-16.2, HU-17.1 y HU-17.2, CU-17 pasos 3 a 6, contra PostgreSQL real y con un proveedor de IA falso: el
// worker toma el lote pendiente, llama a la IA una vez por pregunta, revisa cada propuesta y guarda las válidas
// como borrador de origen IA, con el costo calculado por proveedor. Anota por qué descarta y cierra el lote como
// completado si alguna pregunta fue válida y fallido si ninguna.
import { describe, expect, it, vi } from 'vitest';
import type { SolicitudGeneracion } from '../adaptadores/ia/proveedor.js';
import { ErrorIANoDisponible, ErrorIASaldoAgotado } from '../comun/errores.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador } from './generador-bd.js';
import { crearIaFalsa, propuestaValida, resultadoValido } from './ia-falsa.js';

const valida = (s: SolicitudGeneracion, n: number) => resultadoValido(s, n);
/** Una respuesta válida en todo salvo en lo que se cambie de la propuesta. */
const conCambios = (cambios: Record<string, unknown>) => (s: SolicitudGeneracion, n: number) => ({
  ...resultadoValido(s, n),
  preguntas: [{ ...propuestaValida(s, n), ...cambios }],
});

interface AlternativaGuardada {
  letra: string;
  texto: string;
  correcta: boolean;
  explicacion: string;
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('el worker procesa un lote con PostgreSQL (CU-17)', () => {
  const g = prepararGenerador('worker');
  const { entorno, ia } = g;

  async function pedir(cantidad: number, contenidoId = g.contenidos.m1): Promise<number> {
    const respuesta = await g.pedirLote(await g.sesionAdmin(), { contenidoId, cantidad });
    expect(respuesta.status).toBe(202);
    return respuesta.body.data.id as number;
  }

  const preguntasDelLote = async (id: number) =>
    (
      await entorno.bd.query<Record<string, unknown>>(
        `SELECT p.id, p.enunciado, e.codigo AS estado, p.dificultad_asignada_id, p.autor_id,
                h.codigo AS habilidad, p.lote_id::int AS lote_id,
                (SELECT json_agg(json_build_object('letra', a.letra, 'texto', a.texto, 'correcta', a.es_correcta,
                                                   'explicacion', a.explicacion) ORDER BY a.letra)
                   FROM contenido.alternativa a WHERE a.pregunta_id = p.id) AS alternativas
           FROM contenido.pregunta p
           JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
           JOIN contenido.habilidad h ON h.id = p.habilidad_id
          WHERE p.lote_id = $1 ORDER BY p.id`,
        [id],
      )
    ).rows;

  it('llama a la IA una vez por pregunta y guarda cada válida como borrador de origen IA', async () => {
    const id = await pedir(5);

    const procesados = await g.trabajador().procesarPendientes();

    expect(procesados).toBe(1);
    expect(ia.generarPreguntas).toHaveBeenCalledTimes(5);
    const preguntas = await preguntasDelLote(id);
    expect(preguntas).toHaveLength(5);
    expect(preguntas[0]).toMatchObject({
      estado: 'borrador',
      lote_id: id,
      autor_id: null,
      dificultad_asignada_id: null,
    });
    expect(await g.filaDeLote(id)).toMatchObject({
      estado: 'completado',
      validas: 5,
      descartadas: 0,
    });
  });

  it('cada pregunta guarda 4 alternativas con una sola correcta y la explicación de cada una', async () => {
    const id = await pedir(3);

    await g.trabajador().procesarPendientes();

    for (const pregunta of await preguntasDelLote(id)) {
      const alternativas = pregunta['alternativas'] as AlternativaGuardada[];
      expect(alternativas.map((a) => a.letra)).toEqual(['A', 'B', 'C', 'D']);
      expect(alternativas.filter((a) => a.correcta)).toHaveLength(1);
      expect(alternativas.every((a) => a.explicacion.length > 0)).toBe(true);
      expect(alternativas.find((a) => a.correcta)?.texto).toBe('$5$');
    }
  });

  it('el servidor baraja las alternativas: la clave no queda siempre donde la puso el modelo', async () => {
    const id = await pedir(10);
    const secuencia = [0.9, 0.1, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.05];
    let i = 0;
    const azar = () => secuencia[i++ % secuencia.length]!;

    await g.trabajador({ opcionesGenerador: { aleatorio: azar } }).procesarPendientes();

    const letras = (await preguntasDelLote(id)).map(
      (p) => (p['alternativas'] as AlternativaGuardada[]).find((a) => a.correcta)?.letra,
    );
    expect(new Set(letras).size).toBeGreaterThan(1);
    expect(await g.filaDeLote(id)).toMatchObject({ validas: 10 });
  });

  it('la ficha de cada pregunta pide una habilidad de la prueba y la pregunta la guarda', async () => {
    const id = await pedir(6);

    await g.trabajador().procesarPendientes();

    const habilidades = (await preguntasDelLote(id)).map((p) => p['habilidad']);
    expect(new Set(habilidades).size).toBeGreaterThan(1);
    for (const solicitud of ia.llamadas) {
      expect(solicitud.formato).toMatchObject({ alternativas: 4 });
      expect(solicitud.temperaturas).toEqual({ deepseek: 0.7 });
    }
  });

  it('M2 pide 5 alternativas, el máximo que admite la prueba (RN-08)', async () => {
    const id = await pedir(2, g.contenidos.m2);

    await g.trabajador().procesarPendientes();

    for (const pregunta of await preguntasDelLote(id)) {
      expect(pregunta['alternativas'] as unknown[]).toHaveLength(5);
    }
    expect(ia.llamadas.every((s) => s.formato?.alternativas === 5)).toBe(true);
  });

  describe('costo y tokens por proveedor', () => {
    it('suma los tokens y el costo de cada llamada, con los precios del proveedor que respondió', async () => {
      const id = await pedir(4);
      // DeepSeek: 300 de entrada y 600 de salida cuestan 0,00081 USD, redondeado hacia arriba a 0,0009.
      // Gemini: 1000 × 0,54 + 2000 × 4,5 por millón = 0,00954 USD, que sube a 0,0096.
      const conRespaldo = crearIaFalsa({ usa: ['deepseek', 'gemini'] });
      conRespaldo.encolar(valida, (s, n) => ({
        ...resultadoValido(s, n),
        proveedor: 'gemini',
        usoTokens: { entrada: 1000, salida: 2000, total: 3000 },
        tokensUsados: 3000,
      }));

      await g
        .trabajador({
          proveedores: { ...crearDependenciasDePrueba().proveedores, ia: conRespaldo.proveedor },
        })
        .procesarPendientes();

      const fila = await g.filaDeLote(id);
      expect(fila['tokens_usados']).toBe(900 + 3000 + 900 + 900);
      expect(Number(fila['costo_usd'])).toBeCloseTo(0.0009 + 0.0096 + 0.0009 + 0.0009, 4);
    });

    it('si responde un proveedor sin precio, guarda los tokens sin costo y el lote se detiene sin tratarlo como gratis', async () => {
      const id = await pedir(4);
      ia.encolar((s, n) => ({ ...resultadoValido(s, n), proveedor: 'gemini' }));

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas).toHaveBeenCalledTimes(1);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({
        estado: 'completado',
        validas: 1,
        tokens_usados: 900,
        costo_usd: null,
      });
      expect(fila['motivos_descarte']).toMatchObject({ cierre: 'precio_no_configurado' });
    });

    it('con solo el total de tokens, lo cobra al precio más alto del proveedor', async () => {
      const id = await pedir(1);
      ia.encolar((s, n) => ({
        ...resultadoValido(s, n),
        usoTokens: { total: 1_000_000 },
        tokensUsados: 1_000_000,
      }));

      await g.trabajador().procesarPendientes();

      expect(Number((await g.filaDeLote(id))['costo_usd'])).toBeCloseTo(1.2, 4);
    });
  });

  describe('revisión de cada propuesta', () => {
    it('descarta la que no pasa la revisión y anota la regla que la descartó', async () => {
      const id = await pedir(4);
      ia.encolar(conCambios({ resolucion: 'Entonces $x = 9$.' }));

      await g.trabajador().procesarPendientes();

      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'completado', validas: 3, descartadas: 1 });
      expect(fila['motivos_descarte']).toMatchObject({
        porMotivo: { clave_incoherente: 1 },
        reglas: { clave_incoherente: 1 },
        cierre: 'completo',
      });
      expect(await preguntasDelLote(id)).toHaveLength(3);
    });

    it('no guarda un enunciado repetido, ni siquiera de una pregunta ya rechazada o retirada', async () => {
      const id = await pedir(2);
      const repetido = '¿Cuánto vale $y$ si $y + 1 = 3$ en la pregunta antigua?';
      await entorno.bd.query(
        `INSERT INTO contenido.pregunta (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, enunciado,
                                         explicacion, estado_pregunta_id, creado_en, actualizado_en)
         SELECT c.prueba_id, c.id, h.id, t.id, $2, 'Se resta 1.', e.id, now(), now()
           FROM contenido.contenido_tematico c, contenido.habilidad h, contenido.tipo_pregunta t,
                contenido.estado_pregunta e
          WHERE c.id = $1 AND h.prueba_id = c.prueba_id AND t.codigo = 'seleccion_multiple' AND e.es_inicial
          LIMIT 1`,
        [g.contenidos.m1, repetido],
      );
      ia.encolar(conCambios({ enunciado: repetido }));

      await g.trabajador().procesarPendientes();

      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ validas: 1, descartadas: 1 });
      expect(fila['motivos_descarte']).toMatchObject({ porMotivo: { enunciado_duplicado: 1 } });
    });

    it('un enunciado repetido dentro del mismo lote tampoco se guarda dos veces', async () => {
      const id = await pedir(3);
      const mismo = conCambios({
        enunciado: '¿Cuál es el valor de $x$ si $x + 3 = 8$ en este lote?',
      });
      ia.encolar(mismo, mismo);

      await g.trabajador().procesarPendientes();

      expect(await g.filaDeLote(id)).toMatchObject({ validas: 2, descartadas: 1 });
    });

    it('si todas son inválidas, el lote queda fallido con el detalle del descarte', async () => {
      const id = await pedir(3);
      const mala = conCambios({ habilidad: 'XX' });
      ia.encolar(mala, mala, mala);

      await g.trabajador().procesarPendientes();

      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'fallido', validas: 0, descartadas: 3 });
      expect(fila['motivos_descarte']).toMatchObject({ porMotivo: { habilidad_invalida: 3 } });
    });
  });

  describe('cuando la IA falla', () => {
    it('una falla suelta se anota y el lote sigue con lo que tenga: completado (decisión sobre el DAS 4.a)', async () => {
      const id = await pedir(4);
      ia.encolar(new ErrorIANoDisponible());

      await g.trabajador().procesarPendientes();

      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'completado', validas: 3, descartadas: 1 });
      expect(fila['motivos_descarte']).toMatchObject({ fallas: { IA_NO_DISPONIBLE: 1 } });
    });

    it('tras 3 fallas seguidas deja de insistir y cierra el lote como fallido', async () => {
      const id = await pedir(8);
      ia.encolar(new ErrorIANoDisponible(), new ErrorIANoDisponible(), new ErrorIANoDisponible());

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas).toHaveBeenCalledTimes(3);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'fallido', validas: 0, descartadas: 3 });
      expect(fila['motivos_descarte']).toMatchObject({ cierre: 'ia_no_disponible' });
    });

    it('sin saldo detiene el resto del lote y conserva lo ya generado', async () => {
      const id = await pedir(6);
      ia.encolar(valida, valida, new ErrorIASaldoAgotado());

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas).toHaveBeenCalledTimes(3);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'completado', validas: 2, descartadas: 0 });
      expect(fila['motivos_descarte']).toMatchObject({
        fallas: { IA_SALDO_AGOTADO: 1 },
        cierre: 'saldo_agotado',
      });
    });
  });

  describe('topes y precios durante el lote', () => {
    it('el tope mensual se vuelve a comprobar entre llamadas y detiene el lote', async () => {
      const id = await pedir(6);
      await g.parametro('tope_mensual_ia_usd', 0.002);

      await g.trabajador().procesarPendientes();

      // Cada llamada cuesta 0,0009: tras la tercera se pasa de 0,002.
      expect(ia.generarPreguntas).toHaveBeenCalledTimes(3);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'completado', validas: 3 });
      expect(fila['motivos_descarte']).toMatchObject({ cierre: 'tope_mensual' });
    });

    it('sin precio del proveedor no llama a la IA: cierra el lote con su motivo, no lo calcula como gratis', async () => {
      const id = await pedir(3);
      await entorno.bd.query(
        "DELETE FROM contenido.configuracion WHERE clave = 'precio_salida_ia_deepseek'",
      );

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas).not.toHaveBeenCalled();
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'fallido', validas: 0 });
      expect(fila['motivos_descarte']).toMatchObject({ cierre: 'precio_no_configurado' });
    });

    it('un contenido que se desactivó después de pedir el lote cierra el lote sin llamar a la IA', async () => {
      const id = await pedir(3);
      await entorno.bd.query(
        'UPDATE contenido.contenido_tematico SET activo = false WHERE id = $1',
        [g.contenidos.m1],
      );

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas).not.toHaveBeenCalled();
      expect(await g.filaDeLote(id)).toMatchObject({ estado: 'fallido' });
    });
  });

  it('la respuesta del lote cuenta qué pasó sin devolver el texto del modelo ni la instrucción (HU-16.5)', async () => {
    const sesion = await g.sesionAdmin();
    const creado = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 2 });
    const canario = 'CANARIO-DEL-MODELO';
    ia.encolar(conCambios({ enunciado: `¿Qué es ${canario}?`, habilidad: 'XX' }));
    const registrados = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await g.trabajador().procesarPendientes();
    const lote = await g.leerLote(sesion, creado.body.data.id as number);

    expect(lote.status).toBe(200);
    expect(lote.body.data).toMatchObject({ estado: 'completado', validas: 1, descartadas: 1 });
    const salida = JSON.stringify({ lote: lote.body, logs: registrados.mock.calls });
    expect(salida).not.toContain(canario);
    expect(salida).not.toContain('Subtema pedido');
  });

  it('un lote ya cerrado no se vuelve a procesar', async () => {
    await pedir(2);
    await g.trabajador().procesarPendientes();
    ia.reiniciar();

    const otraVez = await g.trabajador().procesarPendientes();

    expect(otraVez).toBe(0);
    expect(ia.generarPreguntas).not.toHaveBeenCalled();
  });
});
