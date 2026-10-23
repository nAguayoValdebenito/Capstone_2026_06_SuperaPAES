// Crea la primera cuenta de administrador de la consola o, con --restablecer, asigna una contraseña
// nueva a un administrador que ya existe (DAS 4.5.3, TEC-02.2). Se ejecuta una vez por base desde el
// computador de quien despliega: contra la base local o contra Neon, con DATABASE_URL solo en esa
// terminal. La contraseña solo se escribe por teclado, sin que se vea: nunca como argumento ni como
// variable de entorno. Sin una terminal interactiva termina sin tocar la base (Render, CI, semillas).
// Uso: npm run crear-admin -w api               (crear la primera cuenta)
//      npm run crear-admin -w api -- --restablecer (contraseña nueva para un administrador)
//      npm run crear-admin:produccion -w api       (versión compilada, mismas opciones)
import { ErrorConfiguracion, leerConfiguracionBaseDeDatos } from '../../comun/configuracion.js';
import {
  buscarAdministrador,
  correoTieneCuenta,
  crearPrimerAdministrador,
  describirConexion,
  ErrorPrimerAdministrador,
  hayAdministradorActivo,
  problemaContrasena,
  problemaCorreo,
  problemaNombre,
  restablecerAdministrador,
} from '../primer-administrador.js';
import { ErrorTerminal, preguntar } from '../terminal.js';
import type { Ejecutor } from '../transaccion.js';
import { ejecutarScript } from './comun.js';

const { stdin, stdout } = process;
const preguntarVisible = (texto: string) => preguntar(stdin, stdout, texto);
const preguntarOculta = (texto: string) => preguntar(stdin, stdout, texto, true);

/** Pregunta hasta que la respuesta no tenga problemas; explica qué falta cada vez. */
async function pedirHasta(pregunta: string, problema: (texto: string) => string | null) {
  for (;;) {
    const respuesta = (await preguntarVisible(pregunta)).trim();
    const falta = problema(respuesta);
    if (!falta) return respuesta;
    console.log(falta);
  }
}

/** Pide la contraseña dos veces, sin mostrarla, hasta que coincidan y cumplan RN-31. */
async function pedirContrasena(correo: string): Promise<string> {
  for (;;) {
    const contrasena = await preguntarOculta('Contraseña (no se muestra): ');
    const repetida = await preguntarOculta('Repite la contraseña: ');
    const falta = problemaContrasena(contrasena, repetida, correo);
    if (!falta) return contrasena;
    console.log(`${falta} Requisitos: de 8 a 72 caracteres y distinta del correo.`);
  }
}

async function crear(cliente: Ejecutor): Promise<void> {
  if (await hayAdministradorActivo(cliente)) {
    console.log('Ya existe un administrador activo: no se creó nada.');
    console.log('Las demás cuentas se crean desde Usuarios internos (C10) en la consola.');
    return;
  }
  const nombre = await pedirHasta('Nombre: ', problemaNombre);
  const correo = await pedirHasta('Correo: ', problemaCorreo);
  if (await correoTieneCuenta(cliente, correo)) {
    throw new ErrorPrimerAdministrador('Ese correo ya tiene una cuenta interna.');
  }
  const contrasena = await pedirContrasena(correo);
  const cuenta = await crearPrimerAdministrador(cliente, { nombre, correo, contrasena });
  console.log(`Administrador creado: id ${cuenta.id}, correo ${cuenta.correo}.`);
}

async function restablecer(cliente: Ejecutor): Promise<void> {
  const correo = await pedirHasta('Correo del administrador: ', problemaCorreo);
  if (!(await buscarAdministrador(cliente, correo))) {
    throw new ErrorPrimerAdministrador(
      'No hay un administrador con ese correo: no se cambió nada.',
    );
  }
  const contrasena = await pedirContrasena(correo);
  const cuenta = await restablecerAdministrador(cliente, correo, contrasena);
  console.log(`Contraseña restablecida y cuenta activa: id ${cuenta.id}, correo ${cuenta.correo}.`);
}

function informar(error: unknown): void {
  if (!(error instanceof ErrorPrimerAdministrador || error instanceof ErrorTerminal)) throw error;
  console.error(`No se hizo ningún cambio: ${error.message}`);
  process.exitCode = 1;
}

async function principal(): Promise<void> {
  if (!stdin.isTTY) {
    throw new ErrorTerminal(
      'crear-admin necesita una terminal interactiva (PowerShell o la de VS Code); no se tocó la base.',
    );
  }
  const modoRestablecer = process.argv.includes('--restablecer');
  console.log(`Base de datos: ${describirConexion(leerConfiguracionBaseDeDatos().url)}.`);
  const respuesta = await preguntarVisible('¿Es la base correcta? Escribe s para continuar: ');
  if (respuesta.trim().toLowerCase() !== 's') {
    console.log('Cancelado: no se tocó la base.');
    return;
  }
  ejecutarScript((cliente) =>
    (modoRestablecer ? restablecer(cliente) : crear(cliente)).catch(informar),
  );
}

principal().catch((error: unknown) => {
  const conocido =
    error instanceof ErrorPrimerAdministrador ||
    error instanceof ErrorTerminal ||
    error instanceof ErrorConfiguracion;
  console.error(conocido ? `No se hizo ningún cambio: ${error.message}` : error);
  process.exitCode = 1;
});
