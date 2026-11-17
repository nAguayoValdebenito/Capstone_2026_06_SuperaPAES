// Los textos legales vigentes (GET /api/v1/app/cuentas/documentos-legales/vigentes): ruta pública de la
// API que usan el registro de la app y las páginas /terminos y /privacidad de la consola (HU-34.4). Es
// del módulo cuentas, pero va aparte de servicios/cuentas.ts (rutas de /admin): se pide sin la sesión.
import { solicitarPublica } from '../api/cliente';
import type { DocumentoLegal, TipoDocumentoPublico } from '../tipos/documentos-legales';

export async function obtenerDocumentosVigentes(senal?: AbortSignal): Promise<DocumentoLegal[]> {
  const { data } = await solicitarPublica<DocumentoLegal[]>(
    '/app/cuentas/documentos-legales/vigentes',
    senal ? { signal: senal } : {},
  );
  return data;
}

/** El documento vigente de ese tipo, o null si todavía no está publicado. */
export const documentoDe = (documentos: readonly DocumentoLegal[], tipo: TipoDocumentoPublico) =>
  documentos.find((documento) => documento.tipo === tipo) ?? null;
