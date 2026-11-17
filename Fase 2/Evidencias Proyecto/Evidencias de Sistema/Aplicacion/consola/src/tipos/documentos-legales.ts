// Textos legales vigentes (contenido.documento_legal, RN-30), como los entrega la ruta pública de la API:
// solo los obligatorios, que tienen página pública en la consola (HU-34.4).

export type TipoDocumentoPublico = 'terminos' | 'privacidad';

export interface DocumentoLegal {
  /** Código de contenido.tipo_documento_legal. */
  tipo: TipoDocumentoPublico;
  /** El texto en Markdown, con su título. */
  texto: string;
}
