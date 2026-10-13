// Punto de entrada: lee la configuración, crea las dependencias reales y arranca la API y el worker.
import { crearApp, crearServicios, type Dependencias } from './app.js';
import { FabricaProveedores } from './adaptadores/fabrica.js';
import { ErrorConfiguracion, leerConfiguracion } from './comun/configuracion.js';
import { registro } from './comun/registro.js';
import { relojDelSistema } from './comun/reloj.js';
import { comprobarBaseDeDatos, crearPool } from './db/conexion.js';
import { crearUnidadDeTrabajo } from './db/transaccion.js';
import { crearWorkerGeneracion } from './trabajos/worker-generacion.js';

function iniciar(): void {
  const config = leerConfiguracion();
  const pool = crearPool(config.baseDeDatos);
  const dependencias: Dependencias = {
    bd: pool,
    unidadDeTrabajo: crearUnidadDeTrabajo(pool),
    comprobarBaseDeDatos: () => comprobarBaseDeDatos(pool),
    proveedores: FabricaProveedores.crear(config, relojDelSistema),
    jwt: config.jwt,
    corsOrigenes: config.corsOrigenes,
    registrarPeticiones: config.entorno !== 'test',
  };
  const servicios = crearServicios(dependencias);
  const app = crearApp(dependencias, servicios);
  const worker = crearWorkerGeneracion(servicios.generador);

  // En Express 5 el callback también recibe el error de escucha (por ejemplo, puerto ocupado).
  const servidor = app.listen(config.puerto, (error?: Error) => {
    if (error) {
      registro.error('No se pudo iniciar la API', { error: error.message });
      process.exit(1);
    }
    worker.iniciar();
    registro.info(`API escuchando en el puerto ${config.puerto}`, {
      entorno: config.entorno,
      proveedores: {
        ia: config.ia.proveedor,
        correo: config.correo.proveedor,
        pagos: config.pagos.proveedor,
      },
    });
  });

  const detener = (senal: string) => {
    registro.info(`Deteniendo la API (${senal})`);
    servidor.close(() => {
      void worker
        .detener()
        .then(() => pool.end())
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => detener('SIGTERM'));
  process.on('SIGINT', () => detener('SIGINT'));
}

try {
  iniciar();
} catch (error) {
  if (error instanceof ErrorConfiguracion) {
    registro.error(error.message);
    process.exit(1);
  }
  throw error;
}
