import { useFormularioTarifa } from '../../estado/formulario-tarifa';
import type { NuevaTarifa, TarifaRevision } from '../../tipos/saldo';
import { enPesos } from '../../utilidades/suscripciones';

const fechaHora = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
});
function HistorialTarifas({ tarifas }: { tarifas: TarifaRevision[] }) {
  return (
    <div className="tabla-desplazable">
      <table className="tabla">
        <caption>Historial de tarifas</caption>
        <thead>
          <tr>
            <th scope="col">Vigencia en Santiago</th>
            <th scope="col">Monto</th>
          </tr>
        </thead>
        <tbody>
          {tarifas.map((tarifa) => (
            <tr key={tarifa.id}>
              <td>{fechaHora.format(new Date(tarifa.vigenteDesde))}</td>
              <td>{enPesos(tarifa.montoClp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CamposTarifa({ estado }: { estado: ReturnType<typeof useFormularioTarifa> }) {
  return (
    <>
      <label className="campo">
        Nuevo monto en pesos
        <input
          type="number"
          min="1"
          max="700"
          step="1"
          required
          value={estado.monto}
          onChange={(e) => estado.setMonto(e.target.value)}
        />
      </label>
      <label className="campo">
        Vigente desde
        <input
          type="datetime-local"
          value={estado.desde}
          onChange={(e) => estado.setDesde(e.target.value)}
        />
        <span className="campo__ayuda">
          Vacío aplica desde ahora. La fecha se ingresa en la zona horaria de tu equipo.
        </span>
      </label>
    </>
  );
}
export function FormularioTarifa({
  tarifas,
  guardando,
  guardar,
}: {
  tarifas: TarifaRevision[];
  guardando: boolean;
  guardar: (datos: NuevaTarifa) => Promise<void>;
}) {
  const estado = useFormularioTarifa(tarifas, guardar);
  return (
    <section className="panel saldo__tarifas">
      <h2>Tarifa por revisión</h2>
      <p>La misma tarifa se aplica a revisiones, clasificación de dificultad y desempates.</p>
      <form
        onSubmit={(evento) => {
          void estado.enviar(evento);
        }}
        className="saldo__filtros"
      >
        <CamposTarifa estado={estado} />
        <button
          className="boton boton--primario"
          type="submit"
          disabled={guardando || tarifas.length === 0}
        >
          {guardando ? 'Guardando...' : 'Registrar tarifa'}
        </button>
      </form>
      {estado.error && <p role="alert">{estado.error}</p>}
      <HistorialTarifas tarifas={tarifas} />
    </section>
  );
}
