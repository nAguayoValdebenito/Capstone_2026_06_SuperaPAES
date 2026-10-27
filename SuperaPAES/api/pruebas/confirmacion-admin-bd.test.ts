// Confirmación de la cuenta por el administrador contra PostgreSQL real (HU-05.1, HU-05 escenario 4,
// CU-02b, pantalla C15): búsqueda por correo, confirmación con su fila de auditoría confirmar_cuenta,
// correo pendiente anulado, 409 YA_VERIFICADO sin auditar y permisos (docente 403, estudiante 401).
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { errorConFormato } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { conToken, RUTA_INGRESO, RUTA_USUARIOS } from './escenario-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { estudianteConSesion, pedirCorreo, verificarConEnlace } from './verificacion-de-prueba.js';

const RUTA_ESTUDIANTES = '/api/v1/admin/cuentas/estudiantes';
const confirmarRuta = (id: string) => `${RUTA_ESTUDIANTES}/${id}/confirmar-correo`;

interface FilaAuditoria {
  usuario_id: string;
  accion: string;
  entidad: string;
  entidad_id: string;
  antes: unknown;
  despues: unknown;
}

describe('confirmación por el administrador sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('confirmación por el administrador con PostgreSQL (CU-02b)', () => {
  const entorno = usarBaseDeSesiones('confirmacion');
  let areaId: number | undefined;

  beforeAll(async () => {
    const { rows } = await entorno.bd.query<{ id: number }>(
      `INSERT INTO contenido.area (nombre) VALUES ('Área de prueba') RETURNING id`,
    );
    areaId = rows[0]?.id;
  });

  async function sesionAdmin() {
    const credenciales = await entorno.crearAdmin();
    const ingreso = await request(entorno.app).post(RUTA_INGRESO).send(credenciales);
    const { rows } = await entorno.bd.query<{ id: string }>(
      'SELECT id::text AS id FROM contenido.usuario_interno WHERE correo = $1',
      [credenciales.correo],
    );
    return { id: rows[0]?.id, sesion: conToken(ingreso.body.data.tokenAcceso as string) };
  }

  const auditoria = async () =>
    (
      await entorno.bd.query<FilaAuditoria>(
        `SELECT a.usuario_id::text AS usuario_id, aa.codigo AS accion, a.entidad, a.entidad_id,
                a.antes, a.despues
           FROM contenido.auditoria a
           JOIN contenido.accion_auditoria aa ON aa.id = a.accion_auditoria_id
          WHERE aa.codigo = 'confirmar_cuenta'`,
      )
    ).rows;

  it('busca por correo sin distinguir mayúsculas y entrega solo id, nombre, correo, verificado y fecha', async () => {
    const admin = await sesionAdmin();
    const id = await crearEstudianteDePrueba(entorno.bd, {
      nombre: 'Eva Estudiante',
      correo: 'eva@ejemplo.cl',
      contrasena: 'clave-de-eva-1',
    });
    await crearEstudianteDePrueba(entorno.bd, {
      correo: 'borrada@ejemplo.cl',
      contrasena: 'clave-de-prueba-1',
      eliminado: true,
    });
    const buscar = (correo: string) =>
      request(entorno.app).get(RUTA_ESTUDIANTES).query({ correo }).set(admin.sesion);

    const encontrada = await buscar('EVA@Ejemplo.cl');
    const ninguna = await buscar('nadie@ejemplo.cl');
    const eliminada = await buscar('borrada@ejemplo.cl');
    const invalida = await buscar('no-es-correo');

    expect(encontrada.status).toBe(200);
    expect(encontrada.body.data).toEqual([
      {
        id,
        nombre: 'Eva Estudiante',
        correo: 'eva@ejemplo.cl',
        correoVerificado: false,
        creadoEn: expect.any(String) as string,
      },
    ]);
    expect(ninguna.body.data).toEqual([]);
    expect(eliminada.body.data).toEqual([]);
    expect(invalida.status).toBe(400);
  });

  it('confirma: queda verificado, anula el correo pendiente y audita confirmar_cuenta con el antes y el después', async () => {
    const admin = await sesionAdmin();
    const eva = await estudianteConSesion(entorno);
    const { token, codigo } = await pedirCorreo(entorno, eva.sesion);

    const respuesta = await request(entorno.app).post(confirmarRuta(eva.id)).set(admin.sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ id: eva.id, correoVerificado: true });
    const { rows } = await entorno.bd.query<{ verificado: boolean; anulado: boolean }>(
      `SELECT e.correo_verificado AS verificado, t.anulado_en IS NOT NULL AS anulado
         FROM app.estudiante e JOIN app.token_correo t ON t.estudiante_id = e.id WHERE e.id = $1`,
      [eva.id],
    );
    expect(rows).toEqual([{ verificado: true, anulado: true }]);
    const filas = await auditoria();
    expect(filas).toEqual([
      {
        usuario_id: admin.id,
        accion: 'confirmar_cuenta',
        entidad: 'estudiante',
        entidad_id: eva.id,
        antes: { correo_verificado: false },
        despues: { correo_verificado: true },
      },
    ]);
    expect(JSON.stringify(filas)).not.toMatch(new RegExp(`hash|${codigo}|${token}`, 'i'));
    // El enlace anulado ya no verifica nada, pero la cuenta ya está verificada: responde sin error.
    expect((await verificarConEnlace(entorno, token)).body.data.yaVerificado).toBe(true);
  });

  it('si ya estaba verificado responde 409 YA_VERIFICADO y no audita', async () => {
    const admin = await sesionAdmin();
    const id = await crearEstudianteDePrueba(entorno.bd, {
      correo: 'verificada@ejemplo.cl',
      contrasena: 'clave-de-prueba-1',
      correoVerificado: true,
    });

    const respuesta = await request(entorno.app).post(confirmarRuta(id)).set(admin.sesion);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('YA_VERIFICADO'));
    expect(await auditoria()).toEqual([]);
  });

  it('un estudiante inexistente responde 404 y un id inválido, 400', async () => {
    const admin = await sesionAdmin();

    expect(
      (await request(entorno.app).post(confirmarRuta('999999')).set(admin.sesion)).status,
    ).toBe(404);
    expect((await request(entorno.app).post(confirmarRuta('abc')).set(admin.sesion)).status).toBe(
      400,
    );
  });

  it('un docente recibe 403 y un token de estudiante 401 en las rutas de C15', async () => {
    const admin = await sesionAdmin();
    const docente = { correo: 'diego@ejemplo.cl', contrasena: 'clave-de-diego-1' };
    await request(entorno.app)
      .post(RUTA_USUARIOS)
      .set(admin.sesion)
      .send({ nombre: 'Diego Docente', ...docente, rol: 'docente', areas: [areaId] });
    const ingreso = await request(entorno.app).post(RUTA_INGRESO).send(docente);
    const comoDocente = conToken(ingreso.body.data.tokenAcceso as string);
    const eva = await estudianteConSesion(entorno);

    const docenteConfirma = await request(entorno.app).post(confirmarRuta(eva.id)).set(comoDocente);
    const docenteBusca = await request(entorno.app)
      .get(RUTA_ESTUDIANTES)
      .query({ correo: eva.correo })
      .set(comoDocente);
    const estudianteConfirma = await request(entorno.app)
      .post(confirmarRuta(eva.id))
      .set(eva.sesion);
    const sinSesion = await request(entorno.app).post(confirmarRuta(eva.id));

    expect(docenteConfirma.status).toBe(403);
    expect(docenteConfirma.body).toEqual(errorConFormato('SIN_PERMISO'));
    expect(docenteBusca.status).toBe(403);
    expect(estudianteConfirma.status).toBe(401);
    expect(estudianteConfirma.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(sinSesion.status).toBe(401);
    expect(await auditoria()).toEqual([]);
  });
});
