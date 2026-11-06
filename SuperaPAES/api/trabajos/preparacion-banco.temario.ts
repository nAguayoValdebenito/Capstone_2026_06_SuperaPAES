// Una copia local permite reproducir propuestas sin depender de cambios posteriores del temario.
import { z } from 'zod';
import { leerConfiguracionBaseDeDatos } from '../comun/configuracion.js';
import { crearPool } from '../db/conexion.js';
import { crearUnidadDeTrabajo } from '../db/transaccion.js';
import { crearTemarioServicio } from '../modulos/temario/index.js';
import { leerJsonBanco } from './preparacion-banco.archivos.js';

const esquemaTemarioBanco = z.array(
  z.object({
    contenidoId: z.number().int().positive(),
    nombre: z.string(),
    descriptores: z.string().nullable(),
    activo: z.boolean(),
    curso: z.string().nullable(),
    eje: z.object({ id: z.number(), nombre: z.string() }),
    prueba: z.object({
      id: z.number(),
      codigo: z.string(),
      nombre: z.string(),
      opcionesMax: z.number().int().min(4).max(5),
      requiereTexto: z.boolean(),
      tiposPregunta: z.array(z.string()),
      habilidades: z.array(
        z.object({
          id: z.number(),
          codigo: z.string(),
          nombre: z.string(),
          criterios: z.string().nullable(),
        }),
      ),
    }),
  }),
);

export async function cargarTemarioBanco(ruta?: string) {
  if (ruta) return esquemaTemarioBanco.parse(await leerJsonBanco(ruta));
  const pool = crearPool(leerConfiguracionBaseDeDatos());
  try {
    const servicio = crearTemarioServicio({
      bd: pool,
      unidadDeTrabajo: crearUnidadDeTrabajo(pool),
    });
    const pruebas = await servicio.listarTemario();
    const contenidos = [];
    const ids = pruebas.flatMap((p) => p.ejes.flatMap((e) => e.contenidos.map((c) => c.id)));
    for (const id of ids) {
      const detalle = await servicio.contenidoParaGenerar(id);
      if (detalle) contenidos.push(detalle);
    }
    return contenidos;
  } finally {
    await pool.end();
  }
}
