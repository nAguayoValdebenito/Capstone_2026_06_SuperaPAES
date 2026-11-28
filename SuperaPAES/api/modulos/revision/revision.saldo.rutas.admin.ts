import type { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearSaldoControlador } from './revision.saldo.controlador.js';
import type { SaldoDocenteServicio } from './revision.saldo.servicio.js';
import {
  esquemaConsultaSaldo,
  esquemaDocenteSaldo,
  esquemaNuevaTarifa,
} from './revision.saldo.validadores.js';

export function agregarRutasSaldo(router: Router, servicio: SaldoDocenteServicio): void {
  const controlador = crearSaldoControlador(servicio);
  router.get(
    '/mi-saldo',
    exigirRol('docente'),
    validar({ consulta: esquemaConsultaSaldo }),
    controlador.miSaldo,
  );
  router.get(
    '/saldos/:docenteId',
    exigirRol('admin'),
    validar({ parametros: esquemaDocenteSaldo, consulta: esquemaConsultaSaldo }),
    controlador.saldoDocente,
  );
  router.get('/tarifas', exigirRol('admin'), controlador.tarifas);
  router.post(
    '/tarifas',
    exigirRol('admin'),
    validar({ cuerpo: esquemaNuevaTarifa }),
    controlador.registrarTarifa,
  );
}
