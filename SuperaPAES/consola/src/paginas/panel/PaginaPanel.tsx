// C01 · Panel (HU-48, CU-25): indicadores del período elegido, en hora de Chile, sin datos personales.
import { useCallback, useState } from 'react';
import { Pestanas } from '../../componentes/Pestanas';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useCarga } from '../../estado/carga';
import { obtenerPanel } from '../../servicios/administracion';
import type { CantidadPanel, IndicadoresPanel, PeriodoPanel } from '../../tipos/panel';
import { cantidad, diaCorto, PERIODOS } from '../../utilidades/panel';
import { EstadoDelSistema } from './EstadoDelSistema';
import { GraficoRespuestas } from './GraficoRespuestas';
import './panel.css';

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <article className="panel-inicio__indicador">
      <h2>{titulo}</h2>
      <p className="panel-inicio__valor">{valor}</p>
      <p className="campo__ayuda">{detalle}</p>
    </article>
  );
}

function ListaDeCantidades({ titulo, filas }: { titulo: string; filas: readonly CantidadPanel[] }) {
  return (
    <section className="panel panel--ancho" aria-label={titulo}>
      <h2>{titulo}</h2>
      <dl className="panel-inicio__lista">
        {filas.map(({ nombre, total }) => (
          <div key={nombre}>
            <dt>{nombre}</dt>
            <dd>{total}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Indicadores({ datos }: { datos: IndicadoresPanel }) {
  const { estudiantes, suscripciones, ia, preguntas, respuestasPorDia, rango } = datos;
  return (
    <>
      <p className="campo__ayuda">
        Del {diaCorto(rango.desde)} al {diaCorto(rango.hasta)}, en hora de Chile.
      </p>
      <div className="panel-inicio__indicadores">
        <Indicador
          titulo="Estudiantes"
          valor={String(estudiantes.registrados)}
          detalle={`${cantidad(estudiantes.activos, 'activo', 'activos')} en el período`}
        />
        <Indicador
          titulo="Suscripciones vigentes"
          valor={String(suscripciones.vigentes)}
          detalle={`${cantidad(suscripciones.nuevas, 'nueva', 'nuevas')} · ${cantidad(suscripciones.canceladas, 'cancelada', 'canceladas')}`}
        />
        <Indicador
          titulo="Aprobación de la IA"
          valor={ia.tasa === null ? '—' : `${String(ia.tasa)} %`}
          detalle={
            ia.revisadas === 0
              ? 'Sin preguntas revisadas en el período'
              : `${String(ia.aprobadas)} de ${String(ia.revisadas)} preguntas revisadas`
          }
        />
      </div>
      <GraficoRespuestas dias={respuestasPorDia} />
      <div className="panel-inicio__columnas">
        <ListaDeCantidades titulo="Preguntas por estado" filas={preguntas.porEstado} />
        <ListaDeCantidades titulo="Preguntas por dificultad" filas={preguntas.porDificultad} />
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
      <h1>Panel</h1>
      <Pestanas etiqueta="Período" opciones={PERIODOS} valor={periodo} alElegir={setPeriodo} />
      <SegunCarga carga={carga} cargando="Calculando los indicadores…">
        {(datos) => <Indicadores datos={datos} />}
      </SegunCarga>
      <EstadoDelSistema />
    </section>
  );
}
