// HU-29.3: el curso cambia en marzo, en hora de Chile (RF-A04, RN-24, CU-05 1.a), contra PostgreSQL
// real. La base calcula el curso con el año de egreso y la fecha de Chile que sale del reloj de la
// app: aquí el reloj recorre varios años escolares y los bordes del 28/02 (o 29/02) y el 01/03.
// En marzo Chile está en horario de verano (UTC-3); en julio, en horario de invierno (UTC-4).
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { prepararPerfil } from './perfil-de-prueba.js';

/** Mediodía del 27/10/2026 en Chile: año escolar 2026. */
const OCTUBRE_2026 = new Date('2026-10-27T15:00:00.000Z');

/** 00:01 del 1 de marzo en Chile (UTC-3): primer minuto del año escolar. */
const inicioDeMarzo = (anio: number) => new Date(`${String(anio)}-03-01T03:01:00.000Z`);

interface CursoDeHoy {
  curso: string | undefined;
  debeConfirmarCurso: boolean;
}

describe('cambio de curso en marzo sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('cambio de curso en marzo, hora de Chile (HU-29.3)', () => {
  const { entorno, estudianteA, perfilDe, guardar, confirmar, perfilSalud } =
    prepararPerfil('marzo');

  type Estudiante = Awaited<ReturnType<typeof estudianteA>>;

  /** Pone el reloj en la hora indicada y abre otra sesión (la anterior es de otra hora). */
  async function sesionA(estudiante: Estudiante, hora: Date) {
    entorno.fijarHora(hora);
    return estudiante.nuevaSesion();
  }

  /** Curso de hoy y si la app pide confirmarlo, a la hora indicada del reloj. */
  async function cursoA(estudiante: Estudiante, hora: Date): Promise<CursoDeHoy> {
    const respuesta = await perfilDe(await sesionA(estudiante, hora));
    const datos = respuesta.body.data as {
      curso: { codigo: string } | null;
      debeConfirmarCurso: boolean;
    };
    return { curso: datos.curso?.codigo, debeConfirmarCurso: datos.debeConfirmarCurso };
  }

  /** Confirma el curso a la hora indicada y devuelve si la app lo seguiría pidiendo. */
  async function confirmarA(estudiante: Estudiante, hora: Date, cuerpo: Record<string, unknown>) {
    const respuesta = await confirmar(await sesionA(estudiante, hora), cuerpo);
    expect(respuesta.status).toBe(200);
    return (respuesta.body.data as { debeConfirmarCurso: boolean }).debeConfirmarCurso;
  }

  // Ocho ingresos con bcrypt: unos 3 s solo y más de 5 s en la CI, junto a las otras bases temporales.
  it(
    'de 1° medio a egresado: sube un curso cada marzo y se confirma una vez por año',
    async () => {
      const estudiante = await estudianteA(OCTUBRE_2026);
      await guardar(estudiante.sesion, perfilSalud('1M'));

      const recorrido: [number, CursoDeHoy, boolean][] = [];
      for (const [anio, curso] of [
        [2027, '2M'],
        [2028, '3M'],
        [2029, '4M'],
      ] as const) {
        const marzo = await cursoA(estudiante, inicioDeMarzo(anio));
        recorrido.push([anio, marzo, await confirmarA(estudiante, inicioDeMarzo(anio), { curso })]);
      }
      // En 2030 egresó: se le pide confirmar una vez más (al confirmar todavía estaba en 4° medio).
      const egreso = await cursoA(estudiante, inicioDeMarzo(2030));
      const confirmado = await confirmarA(estudiante, inicioDeMarzo(2030), {
        curso: 'EG',
        anioEgreso: 2029,
      });
      const despues = await cursoA(estudiante, inicioDeMarzo(2031));

      expect(recorrido).toEqual([
        [2027, { curso: '2M', debeConfirmarCurso: true }, false],
        [2028, { curso: '3M', debeConfirmarCurso: true }, false],
        [2029, { curso: '4M', debeConfirmarCurso: true }, false],
      ]);
      expect(egreso).toEqual({ curso: 'EG', debeConfirmarCurso: true });
      expect(confirmado).toBe(false);
      expect(despues).toEqual({ curso: 'EG', debeConfirmarCurso: false });
    },
    MINUTO,
  );

  it('año bisiesto: a las 23:59 del 29/02 sigue el año escolar anterior; a las 00:00 del 01/03 cambia', async () => {
    const estudiante = await estudianteA(new Date('2027-10-27T15:00:00.000Z'));
    await guardar(estudiante.sesion, perfilSalud('3M'));

    // 29/02/2028 a las 23:59 en Chile: en UTC ya es 1 de marzo.
    const febrero = await cursoA(estudiante, new Date('2028-03-01T02:59:00.000Z'));
    const marzo = await cursoA(estudiante, new Date('2028-03-01T03:00:00.000Z'));

    expect(febrero).toEqual({ curso: '3M', debeConfirmarCurso: false });
    expect(marzo).toEqual({ curso: '4M', debeConfirmarCurso: true });
  });

  it('una confirmación de febrero es del año escolar anterior: el 1 de marzo se vuelve a pedir', async () => {
    const estudiante = await estudianteA(new Date('2027-02-20T15:00:00.000Z'));

    const guardado = await guardar(estudiante.sesion, perfilSalud('3M'));
    const marzo = await cursoA(estudiante, inicioDeMarzo(2027));

    // En febrero de 2027 todavía corre el año escolar 2026: 3° medio egresa en 2027.
    expect(guardado.body.data).toMatchObject({ anioEgreso: 2027, debeConfirmarCurso: false });
    expect(marzo).toEqual({ curso: '4M', debeConfirmarCurso: true });
  });

  it('quien elige 4° medio en enero egresa con ese año escolar y en marzo ya es egresado', async () => {
    const estudiante = await estudianteA(new Date('2027-01-15T15:00:00.000Z'));

    const guardado = await guardar(estudiante.sesion, perfilSalud('4M'));
    const marzo = await cursoA(estudiante, inicioDeMarzo(2027));

    expect(guardado.body.data).toMatchObject({ anioEgreso: 2026, curso: { codigo: '4M' } });
    expect(marzo).toEqual({ curso: 'EG', debeConfirmarCurso: true });
  });

  it('a mitad del año escolar (julio, UTC-4) no cambia el curso ni se pide confirmar', async () => {
    const estudiante = await estudianteA(inicioDeMarzo(2027));
    await guardar(estudiante.sesion, perfilSalud('2M'));

    const julio = await cursoA(estudiante, new Date('2027-07-15T16:00:00.000Z'));
    const finDeFebrero = await cursoA(estudiante, new Date('2028-03-01T02:59:00.000Z'));

    expect(julio).toEqual({ curso: '2M', debeConfirmarCurso: false });
    expect(finDeFebrero).toEqual({ curso: '2M', debeConfirmarCurso: false });
  });
});
