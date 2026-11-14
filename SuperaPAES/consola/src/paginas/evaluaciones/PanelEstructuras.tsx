// La sección Estructuras de C08: cada tipo de evaluación de la prueba y su edición (CU-31 pasos 1 a 4).
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useEstructuras } from '../../estado/evaluaciones';
import type { Estructura } from '../../tipos/evaluaciones';
import { gratisDe, preguntasDe, textosDe, tiempoDe } from '../../utilidades/evaluaciones';
import { FormularioEstructura } from './FormularioEstructura';

const COLUMNAS = [
  'Tipo',
  'Preguntas',
  'No puntúan',
  'Tiempo',
  'Textos',
  'Gratis al mes',
  'Acciones',
];

function Fila({
  estructura,
  editando,
  alEditar,
}: {
  estructura: Estructura;
  editando: boolean;
  alEditar: () => void;
}) {
  return (
    <tr aria-current={editando ? 'true' : undefined}>
      <th scope="row">{estructura.tipoNombre}</th>
      <td className="tabla__numero">{preguntasDe(estructura)}</td>
      <td className="tabla__numero">{estructura.noPuntuables}</td>
      <td className="tabla__numero">{tiempoDe(estructura)}</td>
      <td className="tabla__numero">{textosDe(estructura)}</td>
      <td className="tabla__numero">{gratisDe(estructura)}</td>
      <td>
        <button type="button" className="boton boton--chico" disabled={editando} onClick={alEditar}>
          {editando ? 'Editando' : 'Editar'}
        </button>
      </td>
    </tr>
  );
}

export function PanelEstructuras({ pruebaId }: { pruebaId: number }) {
  const { carga, editandoId, editar, guardarEstructura, guardando, error, aviso } =
    useEstructuras(pruebaId);
  return (
    <>
      {aviso && (
        <p className="aviso aviso--exito" role="status">
          {aviso}
        </p>
      )}
      <SegunCarga carga={carga} cargando="Cargando las estructuras…">
        {(estructuras) => {
          const editada = estructuras.find(({ id }) => id === editandoId);
          return (
            <>
              <div className="tabla-desplazable">
                <table className="tabla evaluaciones__tabla">
                  <EncabezadoTabla columnas={COLUMNAS} />
                  <tbody>
                    {estructuras.map((estructura) => (
                      <Fila
                        key={estructura.id}
                        estructura={estructura}
                        editando={estructura.id === editandoId}
                        alEditar={() => editar(estructura.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {editada && (
                <FormularioEstructura
                  key={editada.id}
                  estructura={editada}
                  guardando={guardando}
                  error={error}
                  alGuardar={(datos) => void guardarEstructura(editada.id, datos)}
                  alCancelar={() => editar(null)}
                />
              )}
            </>
          );
        }}
      </SegunCarga>
    </>
  );
}
