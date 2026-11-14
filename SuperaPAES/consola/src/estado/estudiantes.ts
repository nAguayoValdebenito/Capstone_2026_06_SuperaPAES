// C15 · Estudiantes: el listado paginado que carga la API al entrar, el filtro opcional por nombre o
// correo y la confirmación de la cuenta cuando el correo de verificación no llega (CU-02b). Al vaciar el
// buscador vuelve el listado general. Una confirmación se refleja en la fila sin recargar la página.
import { useCallback, useState } from 'react';
import { confirmarCorreoEstudiante, listarEstudiantes } from '../servicios/cuentas';
import type { EstudianteConsola, ListadoEstudiantes } from '../tipos/estudiantes';
import { useCarga, type Carga } from './carga';
import { mensajeDeError } from './usuarios-internos';

/** La lista con los estudiantes ya confirmados en esta visita marcados como verificados. */
export function conConfirmados(
  estudiantes: readonly EstudianteConsola[],
  confirmados: ReadonlySet<number>,
): EstudianteConsola[] {
  return estudiantes.map((estudiante) =>
    confirmados.has(estudiante.id) ? { ...estudiante, correoVerificado: true } : estudiante,
  );
}

/** El texto de la tabla vacía: sin estudiantes registrados o sin coincidencias con el filtro. */
export function textoSinEstudiantes(filtro: string): string {
  return filtro === ''
    ? 'Todavía no hay estudiantes registrados.'
    : `No hay estudiantes cuyo nombre o correo contenga «${filtro}».`;
}

/** El buscador: lo que se escribe y el filtro aplicado; vaciarlo vuelve al listado general. */
function useFiltro(alCambiar: () => void) {
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState('');
  const aplicar = (valor: string) => {
    setFiltro(valor);
    alCambiar();
  };
  return {
    texto,
    filtro,
    escribir: (valor: string) => {
      setTexto(valor);
      if (valor.trim() === '' && filtro !== '') aplicar('');
    },
    buscar: () => aplicar(texto.trim()),
    limpiar: () => {
      setTexto('');
      aplicar('');
    },
  };
}

function useConfirmacion() {
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [confirmados, setConfirmados] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const confirmar = async (id: number) => {
    setConfirmando(id);
    setError(null);
    setAviso(null);
    try {
      await confirmarCorreoEstudiante(id);
      setConfirmados((actuales) => new Set(actuales).add(id));
      setAviso('Cuenta confirmada. El cambio quedó registrado en la auditoría.');
    } catch (causa) {
      setError(mensajeDeError(causa).mensaje);
    } finally {
      setConfirmando(null);
    }
  };
  return { confirmando, confirmados, error, aviso, confirmar };
}

export function useEstudiantes() {
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const filtro = useFiltro(() => setPagina(1));
  const cargar = useCallback(
    (senal: AbortSignal) => listarEstudiantes(filtro.filtro, pagina, senal),
    [filtro.filtro, pagina],
  );
  const carga: Carga<ListadoEstudiantes> = useCarga(cargar, version);
  const confirmacion = useConfirmacion();
  return {
    carga,
    setPagina,
    reintentar: () => setVersion((actual) => actual + 1),
    ...filtro,
    ...confirmacion,
  };
}

export type EstadoEstudiantes = ReturnType<typeof useEstudiantes>;
