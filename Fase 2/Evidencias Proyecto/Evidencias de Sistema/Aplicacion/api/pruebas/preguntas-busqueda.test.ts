// Búsqueda global de preguntas (Ctrl K) por HTTP, sin PostgreSQL: el servicio real con un repositorio
// en memoria. Cubre permisos, validación, la forma del ID (P-0084) y los comodines escapados.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  idDelTexto,
  patronDeBusqueda,
  type BusquedaRepositorio,
  type PreguntaEncontrada,
} from '../modulos/preguntas/preguntas.busqueda.js';
import { tokenAdmin } from './ayudantes.js';
import { comoAdmin, escenarioEdicion, problemas, RUTA_PREGUNTAS } from './edicion-de-prueba.js';

const RUTA = `${RUTA_PREGUNTAS}/busqueda`;
const ENCONTRADA: PreguntaEncontrada = {
  id: '84',
  resumen: '¿Cuál es el símbolo químico del sodio?',
  prueba: { codigo: 'CIE' },
  estado: { codigo: 'publicada', nombre: 'Publicada' },
};

function escenario() {
  const buscar = vi.fn(() => Promise.resolve([ENCONTRADA]));
  const repositorioBusqueda: BusquedaRepositorio = { buscar };
  return { ...escenarioEdicion(undefined, undefined, undefined, { repositorioBusqueda }), buscar };
}

describe('forma del texto de búsqueda', () => {
  it.each([
    ['P-0084', '84'],
    ['p84', '84'],
    [' 84 ', '84'],
    ['sodio', null],
    ['P-84 sodio', null],
  ])('el ID de «%s» es %s', (texto, id) => {
    expect(idDelTexto(texto)).toBe(id);
  });

  it('quita tildes y mayúsculas y escapa los comodines de LIKE', () => {
    expect(patronDeBusqueda(' Símbolo QUÍMICO ')).toBe('%simbolo quimico%');
    expect(patronDeBusqueda('50%_x\\')).toBe('%50\\%\\_x\\\\%');
  });
});

describe('GET /admin/preguntas/busqueda', () => {
  it('entrega las coincidencias con el ID exacto, el patrón y el límite por defecto', async () => {
    const { app, buscar } = escenario();
    const respuesta = await request(app)
      .get(`${RUTA}?texto=P-0084`)
      .set(await comoAdmin());
    expect(respuesta.status).toBe(200);
    // El id sale como número en la respuesta (convención de ids de la API).
    expect(respuesta.body).toEqual({
      data: [{ ...ENCONTRADA, id: 84 }],
      error: null,
      meta: null,
    });
    expect(buscar).toHaveBeenCalledWith({ id: '84', patron: '%p-0084%', limite: 8 });
  });

  it('acepta un límite hasta 20 y rechaza el texto vacío o un límite mayor', async () => {
    const { app, buscar } = escenario();
    const admin = await comoAdmin();
    await request(app).get(`${RUTA}?texto=sodio&limite=20`).set(admin);
    expect(buscar).toHaveBeenCalledWith({ id: null, patron: '%sodio%', limite: 20 });
    expect((await request(app).get(`${RUTA}?texto=`).set(admin)).status).toBe(400);
    const largo = await request(app).get(`${RUTA}?texto=a&limite=21`).set(admin);
    expect(largo.status).toBe(400);
    expect(problemas(largo).length).toBeGreaterThan(0);
  });

  it('el docente no puede buscar (403) y sin sesión tampoco (401)', async () => {
    const { app, buscar } = escenario();
    const docente = { Authorization: `Bearer ${await tokenAdmin('docente', '21')}` };
    expect((await request(app).get(`${RUTA}?texto=a`).set(docente)).status).toBe(403);
    expect((await request(app).get(`${RUTA}?texto=a`)).status).toBe(401);
    expect(buscar).not.toHaveBeenCalled();
  });
});
