// Crea el primer administrador de la consola (TEC-02.2). Se ejecuta una sola vez por base: en la base
// local y, desde el computador del equipo, contra Neon con su DATABASE_URL solo para este comando.
// Pide nombre, correo y contraseña (sin mostrarla), valida RN-31, la guarda con el componente común de
// contraseñas y audita la creación con la misma cuenta como autor. Se niega si ya existe un
// administrador: las demás cuentas se crean desde Usuarios internos (C10).
// Uso: npm run crear-admin -w api (con DATABASE_URL y DATABASE_SSL en api/.env o en el entorno).
// Es una raíz de composición, como servidor.ts: arma el servicio de administracion con la conexión.
import { ErrorAplicacion } from '../comun/errores.js';
import { ejecutarScript } from '../db/scripts/comun.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import { ErrorTerminal, preguntar } from './terminal.js';

async function pedirDatos() {
  const { stdin, stdout } = process;
  const nombre = await preguntar(stdin, stdout, 'Nombre: ');
  const correo = await preguntar(stdin, stdout, 'Correo: ');
  const contrasena = await preguntar(stdin, stdout, 'Contraseña (no se muestra): ', true);
  const repetida = await preguntar(stdin, stdout, 'Repite la contraseña: ', true);
  if (contrasena !== repetida) throw new ErrorTerminal('Las contraseñas no coinciden.');
  return { nombre, correo, contrasena };
}

function informarError(error: unknown): boolean {
  if (error instanceof ErrorTerminal || error instanceof ErrorAplicacion) {
    console.error(`No se creó el administrador: ${error.message}`);
    process.exitCode = 1;
    return true;
  }
  return false;
}

ejecutarScript(async (cliente) => {
  const administracion = crearAdministracionServicio({
    bd: cliente,
    unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(cliente, trabajo) },
  });
  try {
    const creado = await administracion.crearPrimerAdministrador(await pedirDatos());
    console.log(`Administrador creado: ${creado.nombre} <${creado.correo}> (id ${creado.id}).`);
  } catch (error) {
    if (!informarError(error)) throw error;
  }
});
