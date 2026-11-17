// Unico lugar con SQL de HU-51. Cada consulta acepta la transaccion del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export interface FilaConfiguracion {
  clave: string;
  valor: unknown;
  descripcion: string;
  actualizadoEn: Date;
  actualizadoPor: string | null;
}

export interface ConfiguracionRepositorio {
  listar(tx?: Ejecutor): Promise<FilaConfiguracion[]>;
  buscar(clave: string, bloquear: boolean, tx?: Ejecutor): Promise<FilaConfiguracion | null>;
  actualizar(
    clave: string,
    valor: number,
    autorId: string,
    tx: Ejecutor,
  ): Promise<FilaConfiguracion>;
}

const SELECCION = `
  SELECT c.clave, c.valor, c.descripcion, c.actualizado_en AS "actualizadoEn",
         u.nombre AS "actualizadoPor"
    FROM contenido.configuracion c
    LEFT JOIN contenido.usuario_interno u ON u.id = c.actualizado_por`;

export function crearConfiguracionRepositorio(bd: Ejecutor): ConfiguracionRepositorio {
  const buscar = async (clave: string, bloquear: boolean, tx: Ejecutor = bd) => {
    const sql = `${SELECCION} WHERE c.clave = $1${bloquear ? ' FOR UPDATE OF c' : ''}`;
    const { rows } = await tx.query<FilaConfiguracion>(sql, [clave]);
    return rows[0] ?? null;
  };
  return {
    async listar(tx = bd) {
      const { rows } = await tx.query<FilaConfiguracion>(`${SELECCION} ORDER BY c.clave`);
      return rows;
    },
    buscar,
    async actualizar(clave, valor, autorId, tx) {
      await tx.query(
        `UPDATE contenido.configuracion
            SET valor = $2::jsonb, actualizado_por = $3,
                actualizado_en = GREATEST(clock_timestamp(), actualizado_en + interval '1 millisecond')
          WHERE clave = $1`,
        [clave, JSON.stringify(valor), autorId],
      );
      const fila = await buscar(clave, false, tx);
      if (!fila) throw new Error('El parametro actualizado no se pudo leer.');
      return fila;
    },
  };
}
