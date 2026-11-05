// Carga de una tabla de conversión del DEMRE (CU-31 paso 5): prueba, año, proceso y sus filas pegadas desde Excel.
import { useState, type FormEvent } from 'react';
import { Alerta } from '../../componentes/Alerta';
import { Selector } from '../../componentes/Selector';
import type { NuevaTabla, OpcionConfiguracion } from '../../tipos/evaluaciones';
import {
  leerTabla,
  problemaDeLaCarga,
  type CamposTabla as Campos,
} from '../../utilidades/evaluaciones';
import { deTemario, numero } from '../../utilidades/opciones';

function CamposTabla({
  campos,
  procesos,
  electivos,
  alCambiar,
}: {
  campos: Campos;
  procesos: readonly OpcionConfiguracion[];
  electivos: readonly OpcionConfiguracion[];
  alCambiar: (cambio: Partial<Campos>) => void;
}) {
  return (
    <div className="evaluaciones__campos">
      <label className="campo">
        Año de admisión
        <input
          type="number"
          min={2023}
          value={campos.anio}
          onChange={(evento) => alCambiar({ anio: evento.target.value })}
        />
      </label>
      <Selector
        etiqueta="Proceso"
        valor={campos.procesoId}
        opciones={deTemario(procesos)}
        textoVacio={null}
        alCambiar={(valor) => alCambiar({ procesoId: numero(valor) })}
      />
      {electivos.length > 0 && (
        <Selector
          etiqueta="Electivo"
          valor={campos.electivoId}
          opciones={deTemario(electivos)}
          textoVacio="Elige el electivo"
          alCambiar={(valor) => alCambiar({ electivoId: numero(valor) })}
        />
      )}
      <label className="campo">
        Fecha de publicación
        <input
          type="date"
          value={campos.publicadaEn}
          onChange={(evento) => alCambiar({ publicadaEn: evento.target.value })}
        />
      </label>
    </div>
  );
}

const camposIniciales = (procesos: readonly OpcionConfiguracion[]): Campos => ({
  anio: String(new Date().getFullYear()),
  procesoId: procesos[0]?.id,
  publicadaEn: '',
});

function CampoFilas({ valor, alCambiar }: { valor: string; alCambiar: (valor: string) => void }) {
  return (
    <>
      <label className="campo">
        Filas de la tabla
        <textarea
          rows={8}
          value={valor}
          placeholder={'0,100\n1,159\n2,184'}
          onChange={(evento) => alCambiar(evento.target.value)}
        />
      </label>
      <p className="campo__ayuda">
        Una línea por cantidad de correctas, con su puntaje. Puedes pegarla desde Excel. Los ensayos
        siguientes usan la tabla más reciente; los ya rendidos conservan la suya.
      </p>
    </>
  );
}

export function FormularioTabla({
  pruebaId,
  procesos,
  electivos,
  guardando,
  error,
  alGuardar,
}: {
  pruebaId: number;
  procesos: readonly OpcionConfiguracion[];
  electivos: readonly OpcionConfiguracion[];
  guardando: boolean;
  error: string | null;
  alGuardar: (datos: NuevaTabla) => Promise<boolean>;
}) {
  const [campos, setCampos] = useState(() => camposIniciales(procesos));
  const [texto, setTexto] = useState('');
  const [problema, setProblema] = useState<string | null>(null);
  const mensaje = problema ?? error;

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const leida = leerTabla(texto);
    if ('error' in leida) return setProblema(leida.error);
    const datos = problemaDeLaCarga(campos, electivos.length > 0);
    if (typeof datos === 'string') return setProblema(datos);
    setProblema(null);
    if (await alGuardar({ ...datos, pruebaId, filas: leida.filas })) setTexto('');
  };

  return (
    <form className="panel panel--ancho" onSubmit={(evento) => void enviar(evento)} noValidate>
      <h2>Cargar tabla del DEMRE</h2>
      <CamposTabla
        campos={campos}
        procesos={procesos}
        electivos={electivos}
        alCambiar={(cambio) => setCampos({ ...campos, ...cambio })}
      />
      <CampoFilas valor={texto} alCambiar={setTexto} />
      {mensaje && <Alerta texto={mensaje} />}
      <div className="panel__acciones">
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Cargando…' : 'Cargar tabla'}
        </button>
      </div>
    </form>
  );
}
