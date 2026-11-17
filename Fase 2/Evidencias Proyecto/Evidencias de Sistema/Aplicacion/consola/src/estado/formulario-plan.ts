import { useState, type FormEvent } from 'react';
import type { EdicionPlan, PlanAdministrable } from '../tipos/planes';
import { mensajeDeError } from './usuarios-internos';

export function camposDelPlan(plan: PlanAdministrable): EdicionPlan {
  const { nombre, precioClp, productos, activo } = plan;
  return {
    nombre,
    precioClp,
    productos: { ...productos },
    activo,
    alcanceId: plan.alcance.id,
    periodicidadId: plan.periodicidad.id,
  };
}

export function useFormularioPlan(
  plan: PlanAdministrable,
  guardar: (datos: EdicionPlan) => Promise<void>,
) {
  const [campos, setCampos] = useState(() => camposDelPlan(plan));
  const [error, setError] = useState('');
  const cambiar = (cambio: Partial<EdicionPlan>) =>
    setCampos((actual) => ({ ...actual, ...cambio }));
  // Desactivar un plan activo lo saca de la tienda para quien no lo tiene: se confirma antes.
  const [porConfirmar, setPorConfirmar] = useState(false);
  const hacerGuardar = () => {
    setError('');
    guardar(campos).catch((problema: unknown) => setError(mensajeDeError(problema).mensaje));
  };
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (plan.activo && !campos.activo) setPorConfirmar(true);
    else hacerGuardar();
  };
  const confirmar = () => {
    setPorConfirmar(false);
    hacerGuardar();
  };
  const cancelar = () => setPorConfirmar(false);
  return { campos, cambiar, enviar, error, porConfirmar, confirmar, cancelar };
}
