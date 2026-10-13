/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API, sin barra final. Ejemplo: http://localhost:3000 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
