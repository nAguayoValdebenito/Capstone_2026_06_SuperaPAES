// C15 · Estudiantes (HU-05 esc. 4, CU-02b): buscar a un estudiante por su correo y confirmar su cuenta cuando
// el correo de verificación no le llega. La consulta con plan y actividad llega con HU-54.
import { useState, type FormEvent } from 'react';
import { Alerta } from '../../componentes/Alerta';
import { useEstudiantes, type BusquedaEstudiantes } from '../../estado/estudiantes';
import { TablaEstudiantes } from './TablaEstudiantes';
import './estudiantes.css';

function Resultado({
  busqueda,
  confirmando,
  alConfirmar,
}: {
  busqueda: BusquedaEstudiantes;
  confirmando: number | null;
  alConfirmar: (id: number) => void;
}) {
  if (busqueda.tipo === 'buscando') return <p aria-live="polite">Buscando…</p>;
  if (busqueda.tipo === 'inicial') return null;
  if (busqueda.estudiantes.length === 0) return <p>No hay estudiantes con ese correo.</p>;
  return (
    <TablaEstudiantes
      estudiantes={busqueda.estudiantes}
      confirmando={confirmando}
      alConfirmar={alConfirmar}
    />
  );
}

export function PaginaEstudiantes() {
  const { busqueda, confirmando, error, aviso, buscar, confirmar } = useEstudiantes();
  const [correo, setCorreo] = useState('');

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (correo.trim() !== '') void buscar(correo.trim());
  };

  return (
    <section className="pagina pagina--ancha">
      <h1>Estudiantes</h1>
      <p className="pagina__aviso">
        Busca a un estudiante por su correo. Si no le llegó el correo de verificación, confirma su
        cuenta y su cupo diario sube a 20 preguntas.
      </p>
      <form className="filtros" onSubmit={enviar} aria-label="Buscar estudiante">
        <label className="campo estudiantes__correo">
          Correo
          <input
            type="email"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
          />
        </label>
        <button
          type="submit"
          className="boton boton--primario"
          disabled={busqueda.tipo === 'buscando' || correo.trim() === ''}
        >
          Buscar
        </button>
      </form>
      {error && <Alerta texto={error} />}
      {aviso && (
        <p className="estado__ok" role="status">
          {aviso}
        </p>
      )}
      <Resultado
        busqueda={busqueda}
        confirmando={confirmando}
        alConfirmar={(id) => void confirmar(id)}
      />
    </section>
  );
}
