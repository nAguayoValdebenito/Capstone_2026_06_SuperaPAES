import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import { crearSaldoRepositorio, type SaldoRepositorio } from './revision.saldo.repositorio.js';
import type { ConsultaSaldo, NuevaTarifa } from './revision.saldo.validadores.js';

interface DependenciasSaldo {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorioSaldo?: SaldoRepositorio;
}

function validarVigencia(datos: NuevaTarifa, reloj: Reloj): void {
  if (!datos.vigenteDesde || new Date(datos.vigenteDesde) >= reloj()) return;
  const mensaje = 'Elige una fecha futura o aplica desde ahora.';
  throw new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'vigenteDesde', mensaje }], mensaje);
}

export function crearSaldoDocenteServicio(d: DependenciasSaldo) {
  const repositorio = d.repositorioSaldo ?? crearSaldoRepositorio(d.bd);
  return {
    async consultarSaldo(docenteId: string, consulta: ConsultaSaldo) {
      const saldo = await repositorio.consultar(docenteId, consulta, d.reloj());
      if (!saldo) throw new ErrorNoEncontrado('El docente no existe.');
      return saldo;
    },
    async consultarTarifas() {
      const [tarifas, docentes] = await Promise.all([
        repositorio.listarTarifas(),
        repositorio.docentes(),
      ]);
      return { tarifas, docentes };
    },
    async registrarTarifa(autorId: string, datos: NuevaTarifa) {
      validarVigencia(datos, d.reloj);
      return d.unidadDeTrabajo.enTransaccion(async (tx) => {
        await repositorio.reservarTarifas(tx);
        const anteriores = await repositorio.listarTarifas(tx);
        if (anteriores[0]?.id !== String(datos.ultimaTarifaId)) {
          throw new ErrorConflicto('Otro administrador registró una tarifa. Recarga el historial.');
        }
        const tarifa = await repositorio.registrarTarifa(autorId, datos, tx);
        await d.administracion.registrarAuditoria(
          {
            usuarioId: autorId,
            accion: 'registrar_tarifa_revision',
            entidad: 'tarifa_revision',
            entidadId: tarifa.id,
            antes: null,
            despues: { ...tarifa },
          },
          tx,
        );
        return tarifa;
      });
    },
  };
}
export type SaldoDocenteServicio = ReturnType<typeof crearSaldoDocenteServicio>;
