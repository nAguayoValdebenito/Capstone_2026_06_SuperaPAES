// C01 · Panel (HU-48, CU-25): indicadores del período elegido, en hora de Chile, sin datos personales.
import { useCallback, useState } from 'react';
import { Pestanas } from '../../componentes/Pestanas';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useCarga } from '../../estado/carga';
import { obtenerPanel } from '../../servicios/administracion';
import type { CantidadPanel, IndicadoresPanel, PeriodoPanel } from '../../tipos/panel';
import {
  cantidad,
  diaCorto,
  PERIODOS,
  variacionEnPuntos,
  variacionRelativa,
  type Variacion,
} from '../../utilidades/panel';
import { CambioDeCifra } from './CambioDeCifra';
import { RequiereAtencion } from './RequiereAtencion';
import { EstadoDelSistema } from './EstadoDelSistema';
import { GraficoRespuestas } from './GraficoRespuestas';
import './panel.css';

interface PropiedadesIndicador {
  titulo: string;
  valor: string;
  detalle: string;
  /** El cambio de la cifra y con qué se compara (el período anterior o el inicio del período). */
  cambio?: { variacion: Variacion | null; frente: string };
}

function Indicador({ titulo, valor, detalle, cambio }: PropiedadesIndicador) {
  return (
    <div className="cifra-regla">
      <dt>{titulo}</dt>
      <dd>
        {valor}
        {cambio && <CambioDeCifra {...cambio} />}
      </dd>
      <dd className="panel-inicio__detalle">{detalle}</dd>
    </div>
  );
}

function TablaDeCantidades({
  titulo,
  columna,
  filas,
}: {
  titulo: string;
  columna: string;
  filas: readonly CantidadPanel[];
}) {
  return (
    <section aria-label={titulo}>
      <h2>{titulo}</h2>
      <table className="tabla panel-inicio__tabla">
        <thead>
          <tr>
            <th scope="col">{columna}</th>
            <th scope="col" className="tabla__numero">
              Preguntas
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ nombre, total }) => (
            <tr key={nombre}>
              <td>{nombre}</td>
              <td className="tabla__numero">{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ReglaDeIndicadores({ datos }: { datos: IndicadoresPanel }) {
  const { estudiantes, suscripciones, ia, anterior } = datos;
  return (
    <dl className="regla-cifras">
      <Indicador
        titulo="Estudiantes"
        valor={String(estudiantes.registrados)}
        cambio={{
          variacion: variacionRelativa(estudiantes.registrados, anterior.estudiantes.registrados),
          frente: 'al inicio del período',
        }}
        detalle={`${cantidad(estudiantes.activos, 'activo', 'activos')} en el período`}
      />
      <Indicador
        titulo="Suscripciones vigentes"
        valor={String(suscripciones.vigentes)}
        cambio={{
          variacion: variacionRelativa(suscripciones.vigentes, anterior.suscripciones.vigentes),
          frente: 'al inicio del período',
        }}
        detalle={`${cantidad(suscripciones.nuevas, 'nueva', 'nuevas')} · ${cantidad(suscripciones.canceladas, 'cancelada', 'canceladas')}`}
      />
      <Indicador
        titulo="Aprobación de la IA"
        valor={ia.tasa === null ? '—' : `${String(ia.tasa)} %`}
        cambio={{
          variacion: variacionEnPuntos(ia.tasa, anterior.ia.tasa),
          frente: 'al período anterior',
        }}
        detalle={
          ia.revisadas === 0
            ? 'Sin preguntas revisadas en el período'
            : `${String(ia.aprobadas)} de ${String(ia.revisadas)} preguntas revisadas`
        }
      />
    </dl>
  );
}

function Indicadores({ datos }: { datos: IndicadoresPanel }) {
  const { preguntas, respuestasPorDia, rango } = datos;
  return (
    <>
      <p className="estado-vista panel-inicio__rango">
        <span>
          Del <b>{diaCorto(rango.desde)}</b> al <b>{diaCorto(rango.hasta)}</b>, en hora de Chile.
        </span>
      </p>
      <ReglaDeIndicadores datos={datos} />
      <div className="secciones panel-inicio__secciones">
        <GraficoRespuestas dias={respuestasPorDia} />
        <TablaDeCantidades
          titulo="Preguntas por estado"
          columna="Estado"
          filas={preguntas.porEstado}
        />
        <TablaDeCantidades
          titulo="Preguntas por dificultad"
          columna="Dificultad"
          filas={preguntas.porDificultad}
        />
      </div>
    </>
  );
}

export function PaginaPanel() {
  const [periodo, setPeriodo] = useState<PeriodoPanel>('30d');
  const cargar = useCallback((senal: AbortSignal) => obtenerPanel(periodo, senal), [periodo]);
  const carga = useCarga(cargar);
  return (
    <section className="pagina pagina--ancha panel-inicio">
      <header className="pagina__encabezado">
        <h1>Panel</h1>
        <RequiereAtencion />
      </header>
      <Pestanas etiqueta="Período" opciones={PERIODOS} valor={periodo} alElegir={setPeriodo}>
        <SegunCarga carga={carga} cargando="Calculando los indicadores…">
          {(datos) => <Indicadores datos={datos} />}
        </SegunCarga>
      </Pestanas>
      <EstadoDelSistema />
    </section>
  );
}
