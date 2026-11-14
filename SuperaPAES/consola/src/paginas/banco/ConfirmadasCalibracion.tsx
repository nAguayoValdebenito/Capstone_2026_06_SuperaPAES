// Confirmadas en calibración (C02, HU-26.2, RN-15): las preguntas publicadas que algún docente confirmó
// que su dificultad no corresponde al acierto. Desde aquí se retiran; después siguen en la tabla del banco
// con «Volver a borrador» y «Enviar a revisión», las mismas acciones de siempre (RF-G09). Sin confirmadas
// no se muestra nada.
import { Link } from 'react-router';
import { Alerta } from '../../componentes/Alerta';
import { claveDeAccion, type AccionesDelBanco } from '../../estado/acciones-banco';
import type { Carga } from '../../estado/carga';
import { textoDeAcierto, textoDeDecisiones } from '../../estado/calibracion';
import type { ConfirmadaCalibracion } from '../../tipos/calibracion';

function Confirmada({
  pregunta,
  acciones,
}: {
  pregunta: ConfirmadaCalibracion;
  acciones?: AccionesDelBanco;
}) {
  const id = Number(pregunta.preguntaId);
  const retirada = acciones?.hechas.has(claveDeAccion(id, 'retirar')) ?? false;
  return (
    <li className="confirmadas__item">
      <p className="confirmadas__pregunta">
        <Link to={`/banco/${pregunta.preguntaId}`}>{`P-${pregunta.preguntaId}`}</Link>{' '}
        {pregunta.enunciado}
      </p>
      <p className="tabla__secundario">
        {`${pregunta.dificultad.nombre}: ${textoDeAcierto(pregunta.porcentajeAcierto, pregunta.dificultad)} · ${String(pregunta.intentos)} intentos`}
      </p>
      <p className="tabla__secundario">{textoDeDecisiones(pregunta)}</p>
      {acciones && (
        <button
          type="button"
          className="boton"
          disabled={acciones.enCurso !== null || retirada}
          onClick={() => acciones.ejecutar(id, 'retirar')}
        >
          {retirada ? 'Retirada' : 'Retirar'}
        </button>
      )}
    </li>
  );
}

export function ConfirmadasCalibracion({
  carga,
  acciones,
}: {
  carga: Carga<ConfirmadaCalibracion[]>;
  acciones?: AccionesDelBanco;
}) {
  if (carga.tipo === 'fallida') return <Alerta texto={carga.mensaje} codigo={carga.codigo} />;
  if (carga.tipo === 'cargando' || carga.datos.length === 0) return null;
  return (
    <section className="panel confirmadas" aria-labelledby="confirmadas-titulo">
      <h2 id="confirmadas-titulo">{`Confirmadas en calibración (${String(carga.datos.length)})`}</h2>
      <p className="pagina__aviso">
        Los docentes del área confirmaron que su dificultad no corresponde al acierto. Retírala,
        vuelve a borrador y envíala a una nueva revisión con dos docentes.
      </p>
      <ul className="confirmadas__lista">
        {carga.datos.map((pregunta) => (
          <Confirmada key={pregunta.preguntaId} pregunta={pregunta} acciones={acciones} />
        ))}
      </ul>
    </section>
  );
}
