// Certificados raíz de Apple para verificar la cadena de las transacciones firmadas (JWS) de la App
// Store (DAS 4.3.3). Son públicos: se guardan en adaptadores/pagos/certificados/ tal como los publica
// Apple, sin cambios. tsc no copia los .cer a dist: se buscan subiendo desde este archivo, así sirven en
// desarrollo (tsx), compilados (dist) y en la imagen de Docker, que copia la carpeta.
//
// AppleRootCA-G3.cer: Apple Root CA - G3, vigente hasta el 30/04/2039.
//   Origen oficial: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
//   (Apple PKI, https://www.apple.com/certificateauthority/, sección «Apple Root Certificates»).
//   Descargado el 31/10/2026.
//   SHA-256: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
// Solo G3: es la raíz de la cadena ECDSA con que Apple firma las transacciones y los avisos V2.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Huella SHA-256 de cada archivo: un archivo cambiado no se usa. */
export const HUELLAS_RAIZ_APPLE: Readonly<Record<string, string>> = {
  'AppleRootCA-G3.cer': '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179',
};

function carpetaDeCertificados(): string {
  let actual = import.meta.dirname;
  while (true) {
    const candidato = path.join(actual, 'adaptadores', 'pagos', 'certificados');
    if (existsSync(candidato)) return candidato;
    const padre = path.dirname(actual);
    if (padre === actual) throw new Error('No se encontró adaptadores/pagos/certificados.');
    actual = padre;
  }
}

/** Los certificados raíz en DER, después de comprobar la huella de cada uno. */
export function certificadosRaizApple(): Buffer[] {
  const carpeta = carpetaDeCertificados();
  return Object.entries(HUELLAS_RAIZ_APPLE).map(([archivo, huella]) => {
    const contenido = readFileSync(path.join(carpeta, archivo));
    if (createHash('sha256').update(contenido).digest('hex') !== huella)
      throw new Error(`El certificado ${archivo} no tiene la huella publicada por Apple.`);
    return contenido;
  });
}
