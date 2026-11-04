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
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setError('');
    guardar(campos).catch((problema: unknown) => setError(mensajeDeError(problema).mensaje));
  };
  return { campos, cambiar, enviar, error };
}
