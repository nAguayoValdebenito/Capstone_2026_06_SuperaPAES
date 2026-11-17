import { afterEach, describe, expect, it, vi } from 'vitest';
import { responderUnaVez } from '../pruebas/sesion';
import { descargarPlantilla } from './plantillas-importacion';

const PLANTILLAS = {
  preguntas: { nombre: 'plantilla_preguntas.csv', contenido: '\uFEFFprueba;eje\r\n' },
  textos: {
    nombre: 'plantilla_textos.csv',
    contenido: '\uFEFFcodigo;tipo_texto;titulo;contenido\r\n',
  },
};

function navegador() {
  const enlace = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
  const crear = vi.fn(() => enlace);
  const agregar = vi.fn();
  vi.stubGlobal('document', { createElement: crear, body: { append: agregar } });
  const crearUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:plantilla');
  const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  return { enlace, crear, agregar, crearUrl, revocar };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('descargar plantillas CSV (HU-13.3)', () => {
  it.each(['preguntas', 'textos'] as const)(
    'descarga %s con el nombre y contenido del servidor',
    async (cual) => {
      vi.useFakeTimers();
      const { enlace, crear, agregar, crearUrl, revocar } = navegador();
      responderUnaVez({ data: PLANTILLAS, error: null, meta: null });

      await descargarPlantilla(cual);

      expect(vi.mocked(fetch).mock.calls[0]?.[0]).toMatch(
        /\/api\/v1\/admin\/preguntas\/importaciones\/plantillas$/,
      );
      expect(crear).toHaveBeenCalledWith('a');
      expect(enlace.download).toBe(PLANTILLAS[cual].nombre);
      expect(enlace.href).toBe('blob:plantilla');
      expect(agregar).toHaveBeenCalledWith(enlace);
      expect(enlace.click).toHaveBeenCalledTimes(1);
      expect(enlace.remove).toHaveBeenCalledTimes(1);
      const archivo = crearUrl.mock.calls[0]?.[0] as Blob;
      expect(archivo.type).toBe('text/csv;charset=utf-8');
      // Compara bytes: Blob.text() puede omitir el BOM al decodificar.
      expect(new Uint8Array(await archivo.arrayBuffer())).toEqual(
        new TextEncoder().encode(PLANTILLAS[cual].contenido),
      );
      expect(revocar).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revocar).toHaveBeenCalledWith('blob:plantilla');
    },
  );

  it('si falla la API no inicia una descarga ni crea archivos vacíos', async () => {
    const { crear, crearUrl } = navegador();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('sin conexión')));
    await expect(descargarPlantilla('preguntas')).rejects.toThrow();
    expect(crear).not.toHaveBeenCalled();
    expect(crearUrl).not.toHaveBeenCalled();
  });

  it('libera el enlace y la URL aunque el navegador falle al iniciar la descarga', async () => {
    vi.useFakeTimers();
    const { enlace, revocar } = navegador();
    enlace.click.mockImplementation(() => {
      throw new Error('descarga rechazada');
    });
    responderUnaVez({ data: PLANTILLAS, error: null, meta: null });
    await expect(descargarPlantilla('textos')).rejects.toThrow('descarga rechazada');
    expect(enlace.remove).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(revocar).toHaveBeenCalledWith('blob:plantilla');
  });
});
