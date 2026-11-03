// C16 · Suscripciones (HU-56): lo que se ve del resumen, la lista, la línea de tiempo y la bandeja de
// avisos con error. Nunca hay datos de tarjetas, y una cuenta eliminada sale seudonimizada.
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SegunCarga } from '../../componentes/SegunCarga';
import { textoDibujado } from '../../pruebas/dibujo';
import { detalleDePrueba, resumenDePrueba } from '../../pruebas/suscripciones';
import { conteoDeAvisos, lecturaDelCambio } from '../../utilidades/suscripciones';
import { AvisosConError } from './AvisosConError';
import { LineaDeTiempo } from './LineaDeTiempo';
import { PaginaSuscripciones } from './PaginaSuscripciones';
import { ResumenPorPlanYMes, TarjetasDelMes } from './ResumenSuscripciones';
import { TablaSuscripciones } from './TablaSuscripciones';

const sinAccion = () => undefined;

describe('resumen de suscripciones (HU-56 esc. 1)', () => {
  it('muestra las tarjetas del mes con los ingresos en pesos', () => {
    const html = textoDibujado(<TarjetasDelMes resumen={resumenDePrueba} />);

    for (const texto of ['Activas', '12', 'En mora', 'Altas del mes', 'Cancelaciones del mes'])
      expect(html).toContain(texto);
    expect(html).toContain('$29.900');
  });

  it('muestra las suscripciones por plan y estado y los pagos de cada mes', () => {
    const html = textoDibujado(<ResumenPorPlanYMes resumen={resumenDePrueba} />);

    expect(html).toContain('<td>Todas las pruebas mensual</td><td>Activa</td><td>9</td>');
    expect(html).toContain('<td>octubre de 2026</td><td>10</td><td>2</td><td>$29.900</td>');
  });
});

describe('lista de suscripciones (HU-56 esc. 2 y 5)', () => {
  const fila = { ...detalleDePrueba, id: 12 };

  it('muestra estudiante, plan, tienda, estado y desde cuándo, y marca la elegida', () => {
    const html = textoDibujado(
      <TablaSuscripciones suscripciones={[fila]} elegida={12} alVer={sinAccion} />,
    );

    expect(html).toContain('estudiante1@correo.cl');
    expect(html).toContain('<td>Google Play</td>');
    expect(html).toContain('etiqueta--activa');
    expect(html).toContain('fila--elegida');
    expect(html).toContain('aria-pressed="true"');
  });

  it('una cuenta eliminada sale como «Cuenta eliminada»; sin resultados lo dice', () => {
    const eliminada = textoDibujado(
      <TablaSuscripciones
        suscripciones={[{ ...fila, correo: null }]}
        elegida={undefined}
        alVer={sinAccion}
      />,
    );
    const vacia = textoDibujado(
      <TablaSuscripciones suscripciones={[]} elegida={undefined} alVer={sinAccion} />,
    );

    expect(eliminada).toContain('Cuenta eliminada');
    expect(vacia).toContain('No hay suscripciones con estos filtros.');
  });
});

describe('línea de tiempo (HU-56 esc. 3, RN-17)', () => {
  it('lee el cambio de plan, el de estado y el primero, con su origen', () => {
    expect(detalleDePrueba.historial.map(lecturaDelCambio)).toEqual([
      {
        titulo: 'Cambio de plan',
        detalle: 'Una prueba mensual a Todas las pruebas mensual · origen: aviso de la tienda',
      },
      { titulo: 'Activa', detalle: 'Pendiente a Activa · origen: aviso de la tienda' },
      {
        titulo: 'Pendiente',
        detalle: 'Una prueba mensual · origen: estudiante · Compra iniciada en la app',
      },
    ]);
  });

  it('un cambio de plan y de estado en el mismo registro muestra los dos (RN-17)', () => {
    const [cambio] = detalleDePrueba.historial;

    expect(
      lecturaDelCambio({ ...cambio!, estadoAnterior: { codigo: 'en_mora', nombre: 'En mora' } }),
    ).toEqual({
      titulo: 'Cambio de plan',
      detalle:
        'Una prueba mensual a Todas las pruebas mensual · En mora a Activa · origen: aviso de la tienda',
    });
  });

  it('cuenta los avisos de la tienda procesados y con error', () => {
    const [aviso] = detalleDePrueba.avisos;
    const conError = { ...aviso!, id: 32, resultado: { codigo: 'error', nombre: 'Error' } };

    expect(conteoDeAvisos([aviso!, conError, { ...conError, id: 33 }])).toEqual({
      procesados: 1,
      conError: 2,
    });
  });

  it('muestra los cambios con su fecha, los pagos y el resumen de los avisos de la tienda', () => {
    const html = textoDibujado(<LineaDeTiempo detalle={detalleDePrueba} />);

    expect(html).toContain('estudiante1@correo.cl · línea de tiempo');
    expect(html).toContain('18-10-2026 · Cambio de plan');
    expect(html).toContain('Pago aprobado $1.990');
    expect(html).toContain('Período del 20-09-2026 al 19-10-2026');
    expect(html).toContain('Avisos de Google Play: 1 procesados, 0 con error.');
  });
});

describe('avisos con error (HU-56 esc. 4)', () => {
  const aviso = {
    ...detalleDePrueba.avisos[0]!,
    resultado: { codigo: 'error', nombre: 'Error' },
    detalle: 'No se encontró la suscripción del token de compra.',
  };

  it('muestra cada aviso con el motivo y si se pudo asociar a una suscripción', () => {
    const html = textoDibujado(
      <AvisosConError
        avisos={[
          { ...aviso, suscripcionId: 12 },
          { ...aviso, id: 32, suscripcionId: null },
        ]}
        alVer={sinAccion}
      />,
    );

    expect(html).toContain('<td>No se encontró la suscripción del token de compra.</td>');
    expect(html).toContain('Ver línea de tiempo');
    expect(html).toContain('Sin asociar');
  });

  it('sin avisos con error lo dice', () => {
    expect(textoDibujado(<AvisosConError avisos={[]} alVer={sinAccion} />)).toContain(
      'No hay avisos con error.',
    );
  });
});

describe('la página C16', () => {
  it('abre cargando, con el modo de prueba y sin datos de tarjetas', () => {
    const html = textoDibujado(
      <MemoryRouter>
        <PaginaSuscripciones />
      </MemoryRouter>,
    );

    expect(html).toContain('<h1>Suscripciones</h1>');
    expect(html).toContain('Nunca se muestran datos de tarjetas.');
    expect(html).toContain('Modo de prueba');
    expect(html).toContain('Cargando el resumen…');
    expect(html).toContain('Cargando suscripciones…');
  });

  it('un error de la API se muestra con su código', () => {
    const html = textoDibujado(
      <SegunCarga
        carga={{ tipo: 'fallida', codigo: 'NO_ENCONTRADO', mensaje: 'La suscripción no existe.' }}
        cargando="Cargando…"
      >
        {() => null}
      </SegunCarga>,
    );

    expect(html).toContain(
      'La suscripción no existe.<span class="estado__codigo"> (NO_ENCONTRADO)</span>',
    );
    expect(html).toContain('role="alert"');
  });
});
