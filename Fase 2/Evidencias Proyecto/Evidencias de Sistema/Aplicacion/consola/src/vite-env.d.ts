/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API, sin barra final. Ejemplo: http://localhost:3000 */
  readonly VITE_API_URL?: string;
  /** Página de invitación (W01): inscripción a la prueba cerrada de Google Play. Vacía: «Pronto en». */
  readonly VITE_ENLACE_GOOGLE_PLAY?: string;
  /** Página de invitación (W01): enlace público de TestFlight. Vacía: «Pronto en». */
  readonly VITE_ENLACE_APP_STORE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
