// Certificado raíz de Apple (HU-43.1): el archivo del repositorio es el que publica Apple en
// https://www.apple.com/certificateauthority/AppleRootCA-G3.cer. La huella SHA-256 se escribe aquí por
// separado de la del código: si alguien cambia el archivo, las dos dejan de coincidir.
import { createHash, X509Certificate } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  certificadosRaizApple,
  HUELLAS_RAIZ_APPLE,
} from '../adaptadores/pagos/certificados-apple.js';

const HUELLA_APPLE_ROOT_CA_G3 =
  '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79';

describe('certificados raíz de Apple', () => {
  it('el archivo tiene la huella SHA-256 publicada de Apple Root CA - G3', () => {
    const [certificado] = certificadosRaizApple();

    expect(certificado).toBeDefined();
    const huella = createHash('sha256')
      .update(certificado ?? Buffer.alloc(0))
      .digest('hex');
    expect(huella).toBe(HUELLA_APPLE_ROOT_CA_G3.replaceAll(':', '').toLowerCase());
    expect(HUELLAS_RAIZ_APPLE).toEqual({ 'AppleRootCA-G3.cer': huella });
  });

  it('es la raíz autofirmada de Apple, vigente hasta 2039', () => {
    const [certificado] = certificadosRaizApple();
    const x509 = new X509Certificate(certificado ?? Buffer.alloc(0));

    expect(x509.subject).toContain('CN=Apple Root CA - G3');
    expect(x509.issuer).toBe(x509.subject);
    expect(x509.ca).toBe(true);
    expect(x509.fingerprint256).toBe(HUELLA_APPLE_ROOT_CA_G3);
    expect(new Date(x509.validTo).getUTCFullYear()).toBe(2039);
  });
});
