// La tabla del banco (C02) con sus acciones, para las pruebas de enviar a revisión (HU-21) y de publicar,
// retirar y volver a borrador (HU-24): preguntas en una etapa, la tabla dibujada y la fila de cada una.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { accionDe, claveDeAccion } from '../estado/acciones-banco';
import { TablaBanco } from '../paginas/banco/TablaBanco';
import type { PreguntaDelBanco } from '../tipos';
import { preguntaDelBanco } from './banco';

/** Una pregunta del banco en la etapa indicada; su resumen es «Pregunta <id>». */
export const preguntaEnEtapa = (id: number, codigo: string, nombre: string, editable = false) =>
  preguntaDelBanco({ id, resumen: `Pregunta ${String(id)}`, estado: { codigo, nombre }, editable });

/** La tabla con la acción `enCurso` y las de las preguntas `hechas` (la acción de su etapa) ya hechas. */
export const dibujarTabla = (
  preguntas: readonly PreguntaDelBanco[],
  enCurso: number | null,
  hechas: number[] = [],
) =>
  renderToString(
    <MemoryRouter>
      <TablaBanco
        preguntas={preguntas}
        acciones={{
          enCurso,
          hechas: new Set(
            preguntas.flatMap((pregunta) => {
              const accion = accionDe(pregunta);
              return accion && hechas.includes(pregunta.id)
                ? [claveDeAccion(pregunta.id, accion)]
                : [];
            }),
          ),
          ejecutar: () => undefined,
        }}
      />
    </MemoryRouter>,
  );

/** La fila de la pregunta en el HTML de la tabla. */
export const filaDe = (html: string, id: number) =>
  html.split('<tr>').find((parte) => parte.includes(`Pregunta ${String(id)}<`)) ?? '';
