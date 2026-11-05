// Llamadas a /api/v1/admin/administracion (módulo administracion de la API): usuarios internos, configuración, auditoría, panel de métricas y estudiantes.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type { IndicadoresPanel, PeriodoPanel } from '../tipos/panel';
import type { CambiosCuenta, CuentaInterna, DatosCuentaNueva } from '../tipos';

const USUARIOS_INTERNOS = '/administracion/usuarios-internos';

export async function listarUsuariosInternos(senal?: AbortSignal): Promise<CuentaInterna[]> {
  const { data } = await solicitarAdmin<CuentaInterna[]>(
    USUARIOS_INTERNOS,
    senal ? { signal: senal } : {},
  );
  return data;
}

export async function crearUsuarioInterno(datos: DatosCuentaNueva): Promise<CuentaInterna> {
  const { data } = await solicitarAdmin<CuentaInterna>(USUARIOS_INTERNOS, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return data;
}

export async function editarUsuarioInterno(
  id: string,
  cambios: CambiosCuenta,
): Promise<CuentaInterna> {
  const { data } = await solicitarAdmin<CuentaInterna>(`${USUARIOS_INTERNOS}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(cambios),
  });
  return data;
}

export async function cambiarEstadoUsuarioInterno(
  id: string,
  activo: boolean,
): Promise<CuentaInterna> {
  const accion = activo ? 'activar' : 'desactivar';
  const { data } = await solicitarAdmin<CuentaInterna>(`${USUARIOS_INTERNOS}/${id}/${accion}`, {
    method: 'POST',
  });
  return data;
}

/** C01: los indicadores del período. */
export async function obtenerPanel(
  periodo: PeriodoPanel,
  senal: AbortSignal,
): Promise<IndicadoresPanel> {
  const ruta = `/administracion/panel?periodo=${periodo}`;
  return (await solicitarAdmin<IndicadoresPanel>(ruta, { signal: senal })).data;
}
