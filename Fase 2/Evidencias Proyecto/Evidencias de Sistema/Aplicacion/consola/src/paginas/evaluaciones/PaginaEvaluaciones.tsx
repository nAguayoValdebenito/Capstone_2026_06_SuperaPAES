// C08 · Evaluaciones (HU-63.2, CU-31): cómo se arma cada evaluación de cada prueba y sus tablas de conversión.
import { useState } from 'react';
import { Pestanas } from '../../componentes/Pestanas';
import { tonoDePrueba } from '../../estado/sello-prueba';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useCarga } from '../../estado/carga';
import { obtenerFiltrosBanco } from '../../servicios/preguntas';
import { PanelEstructuras } from './PanelEstructuras';
import { PanelTablas } from './PanelTablas';
import './evaluaciones.css';

type Seccion = 'estructuras' | 'tablas';

const SECCIONES: readonly { valor: Seccion; texto: string }[] = [
  { valor: 'estructuras', texto: 'Estructuras' },
  { valor: 'tablas', texto: 'Tablas de conversión' },
];

type PruebasDelTemario = ReturnType<
  typeof useCarga<Awaited<ReturnType<typeof obtenerFiltrosBanco>>>
>;
type Pruebas = Extract<PruebasDelTemario, { tipo: 'lista' }>['datos']['pruebas'];

/** Las pestañas de sección y de prueba (con su sello de color) y el panel de la combinación elegida. */
function Contenido({ pruebas }: { pruebas: Pruebas }) {
  const [seccion, setSeccion] = useState<Seccion>('estructuras');
  const [elegida, setElegida] = useState<number | null>(null);
  const pruebaId = pruebas.find(({ id }) => id === elegida)?.id ?? pruebas[0]!.id;
  const opciones = pruebas.map(({ id, nombre, codigo }) => ({
    valor: id,
    texto: nombre,
    sello: tonoDePrueba(codigo),
  }));
  return (
    <Pestanas
      etiqueta="Secciones de evaluaciones"
      opciones={SECCIONES}
      valor={seccion}
      alElegir={setSeccion}
    >
      <Pestanas etiqueta="Prueba" opciones={opciones} valor={pruebaId} alElegir={setElegida}>
        {seccion === 'estructuras' ? (
          <PanelEstructuras key={pruebaId} pruebaId={pruebaId} />
        ) : (
          <PanelTablas key={pruebaId} pruebaId={pruebaId} />
        )}
      </Pestanas>
    </Pestanas>
  );
}

export function PaginaEvaluaciones() {
  const temario = useCarga(obtenerFiltrosBanco);
  return (
    <section className="pagina pagina--ancha evaluaciones">
      <h1>Evaluaciones</h1>
      <p className="pagina__aviso">
        Cómo se arma cada evaluación de cada prueba. Las ya rendidas conservan su estructura.
      </p>
      <SegunCarga carga={temario} cargando="Cargando las pruebas…">
        {({ pruebas }) =>
          pruebas.length === 0 ? (
            <p role="status" className="pagina__aviso">
              No hay pruebas disponibles para configurar evaluaciones.
            </p>
          ) : (
            <Contenido pruebas={pruebas} />
          )
        }
      </SegunCarga>
    </section>
  );
}
