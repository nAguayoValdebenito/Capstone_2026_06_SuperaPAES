// C15 · Estudiantes: el listado paginado que carga la API al entrar, los filtros opcionales por
// suscripción, interés y cuenta verificada, y la confirmación de la cuenta cuando el correo de
// verificación no llega (CU-02b). Cambiar un filtro vuelve a la página 1; «Limpiar filtros» vuelve al
// listado general. Una confirmación se refleja en la fila sin recargar la página.
import { useCallback, useState } from 'react';
import { confirmarCorreoEstudiante, listarEstudiantes } from '../servicios/cuentas';
import { consultarListasOpciones } from '../servicios/temario';
import type {
  EstudianteConsola,
  FiltrosEstudiantes,
  ListadoEstudiantes,
} from '../tipos/estudiantes';
import type { AreaCarreraLista } from '../tipos/temario';
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

export const SIN_FILTROS: FiltrosEstudiantes = { suscripcion: '', interes: '', verificado: '' };

/** Código de interés que pide a quienes no marcaron ningún área de carrera (lo entiende la API). */
export const SIN_INTERESES = 'ninguno';

export const OPCIONES_SUSCRIPCION = [
  { valor: 'activa', texto: 'Activa' },
  { valor: 'sin', texto: 'Sin suscripción activa' },
];

export const OPCIONES_VERIFICADO = [
  { valor: 'si', texto: 'Verificada' },
  { valor: 'no', texto: 'Sin verificar' },
];

/** Las áreas de carrera de la lista de opciones, más «Sin intereses registrados». */
export function opcionesInteres(areas: readonly AreaCarreraLista[]) {
  return [
    ...areas.map((area) => ({ valor: area.codigo, texto: area.nombre })),
    { valor: SIN_INTERESES, texto: 'Sin intereses registrados' },
  ];
}

export const hayFiltros = (filtros: FiltrosEstudiantes): boolean =>
  Object.values(filtros).some((valor) => valor !== '');

/** El texto de la tabla vacía: sin estudiantes registrados o ninguno con esos filtros. */
export const textoSinEstudiantes = (filtros: FiltrosEstudiantes): string =>
  hayFiltros(filtros)
    ? 'No hay estudiantes con esos filtros.'
    : 'Todavía no hay estudiantes registrados.';

const cargarAreas = async (senal: AbortSignal) =>
  (await consultarListasOpciones(senal)).areasCarrera;

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
  const [filtros, setFiltros] = useState<FiltrosEstudiantes>(SIN_FILTROS);
  const cargar = useCallback(
    (senal: AbortSignal) => listarEstudiantes(filtros, pagina, senal),
    [filtros, pagina],
  );
  const carga: Carga<ListadoEstudiantes> = useCarga(cargar, version);
  const areas = useCarga(cargarAreas);
  const confirmacion = useConfirmacion();
  const aplicar = (nuevos: FiltrosEstudiantes) => {
    setFiltros(nuevos);
    setPagina(1);
  };
  return {
    carga,
    setPagina,
    reintentar: () => setVersion((actual) => actual + 1),
    filtros,
    areas,
    cambiarFiltro: <C extends keyof FiltrosEstudiantes>(campo: C, valor: FiltrosEstudiantes[C]) =>
      aplicar({ ...filtros, [campo]: valor }),
    limpiarFiltros: () => aplicar(SIN_FILTROS),
    ...confirmacion,
  };
}

export type EstadoEstudiantes = ReturnType<typeof useEstudiantes>;
