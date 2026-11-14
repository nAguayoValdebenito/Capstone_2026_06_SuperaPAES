// Sección Listas de opciones (C09, HU-64.1): catálogos con su código, su nombre y sus datos propios, de
// solo lectura. Lo único editable es la mezcla global de dificultad (D1, RN-09); los nombres y las demás
// listas siguen pendientes de HU-64 (escenarios 1 a 4).
import { Pestanas } from '../../componentes/Pestanas';
import { SegunCarga } from '../../componentes/SegunCarga';
import {
  LISTAS_OPCIONES,
  type ListaOpciones,
  useListasOpciones,
} from '../../estado/listas-opciones';
import type { ListasOpciones } from '../../tipos/temario';
import { TablaAreasCarrera, TablaOpciones, TablaTiposEvaluacion } from './TablasListas';
import { MezclaDificultad } from './MezclaDificultad';
import './listas-opciones.css';

function Lista({
  lista,
  datos,
  alGuardar,
}: {
  lista: ListaOpciones;
  datos: ListasOpciones;
  alGuardar: () => void;
}) {
  switch (lista) {
    case 'dificultades':
      return <MezclaDificultad dificultades={datos.dificultades} alGuardar={alGuardar} />;
    case 'areasCarrera':
      return <TablaAreasCarrera areas={datos.areasCarrera} />;
    case 'tiposEvaluacion':
      return <TablaTiposEvaluacion tipos={datos.tiposEvaluacion} />;
    case 'motivosAviso':
      return (
        <TablaOpciones
          titulo="Motivos que elige un estudiante al avisar un error en una pregunta"
          vacia="No hay motivos de aviso cargados."
          opciones={datos.motivosAviso}
        />
      );
    case 'tiposPregunta':
      return (
        <TablaOpciones
          titulo="Tipos de pregunta que se ofrecen al crear preguntas"
          vacia="No hay tipos de pregunta cargados."
          opciones={datos.tiposPregunta}
        />
      );
    case 'tiposTexto':
      return (
        <TablaOpciones
          titulo="Tipos de texto que se ofrecen al crear textos de lectura"
          vacia="No hay tipos de texto cargados."
          opciones={datos.tiposTexto}
        />
      );
  }
}

export function PaginaListasOpciones() {
  const estado = useListasOpciones();
  return (
    <section className="pagina pagina--ancha listas-opciones">
      <h1>Listas de opciones</h1>
      <p className="pagina__aviso">
        Opciones que el sistema elige por su código. Se cargan con los datos iniciales y aquí se
        consultan; solo la mezcla de dificultad se puede cambiar.
      </p>
      <SegunCarga carga={estado.carga} cargando="Cargando las listas de opciones…">
        {(datos) => (
          <>
            <Pestanas
              etiqueta="Lista de opciones"
              opciones={LISTAS_OPCIONES}
              valor={estado.lista}
              alElegir={estado.elegir}
            >
              <Lista lista={estado.lista} datos={datos} alGuardar={estado.reintentar} />
            </Pestanas>
          </>
        )}
      </SegunCarga>
      {estado.carga.tipo === 'fallida' && (
        <button className="boton" type="button" onClick={estado.reintentar}>
          Reintentar
        </button>
      )}
    </section>
  );
}
