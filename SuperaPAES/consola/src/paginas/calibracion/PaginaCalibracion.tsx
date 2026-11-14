// D04 · Calibración (HU-26 y HU-53, RF-G13, RN-15): las preguntas del área del docente con 30 o más
// intentos cuyo porcentaje de acierto no coincide con su dificultad. El docente confirma que la dificultad
// no corresponde (pasa al administrador, que la retira y la envía a una nueva revisión) o dice que está
// bien, siempre con una confirmación. La lógica vive en estado/calibracion.ts.
import { useRef } from 'react';
import { Alerta } from '../../componentes/Alerta';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useCalibracion, type EstadoCalibracion } from '../../estado/calibracion';
import type { ItemCalibracion } from '../../tipos/calibracion';
import { ConfirmarDecision } from './ConfirmarDecision';
import { TablaCalibracion } from './TablaCalibracion';
import './calibracion.css';

function Bandeja({ estado, items }: { estado: EstadoCalibracion; items: ItemCalibracion[] }) {
  const boton = useRef<HTMLButtonElement | null>(null);
  if (items.length === 0) {
    return <p className="calibracion__vacio">No hay preguntas para calibrar.</p>;
  }
  const cancelar = () => {
    estado.cancelar();
    requestAnimationFrame(() => boton.current?.focus());
  };
  return (
    <>
      <TablaCalibracion
        items={items}
        alDecidir={(item, corresponde, origen) => {
          boton.current = origen;
          estado.abrir(item, corresponde);
        }}
      />
      {estado.pendiente && (
        <ConfirmarDecision
          pendiente={estado.pendiente}
          enCurso={estado.enCurso}
          alConfirmar={() => void estado.confirmar()}
          alCancelar={cancelar}
        />
      )}
    </>
  );
}

/** La bandeja según la carga: cargando, error con reintento, vacía o la tabla. */
export function VistaCalibracion({ estado }: { estado: EstadoCalibracion }) {
  const { carga, mensaje } = estado;
  return (
    <section className="pagina pagina--ancha calibracion">
      <h1>Calibración</h1>
      <p className="pagina__aviso">
        Preguntas de tu área con 30 o más intentos cuyo porcentaje de acierto no coincide con su
        dificultad.
      </p>
      {mensaje && (
        <p
          className={`aviso aviso--${mensaje.tipo}`}
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
        >
          {mensaje.texto}
        </p>
      )}
      {carga.tipo === 'fallida' ? (
        <div className="calibracion__error">
          <Alerta texto={carga.mensaje} codigo={carga.codigo} />
          <button type="button" className="boton" onClick={estado.reintentar}>
            Reintentar
          </button>
        </div>
      ) : (
        <SegunCarga carga={carga} cargando="Cargando preguntas…">
          {(items) => <Bandeja estado={estado} items={items} />}
        </SegunCarga>
      )}
    </section>
  );
}

export function PaginaCalibracion() {
  return <VistaCalibracion estado={useCalibracion()} />;
}
