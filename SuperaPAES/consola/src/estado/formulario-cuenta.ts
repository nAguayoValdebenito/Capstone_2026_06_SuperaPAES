// Formulario de crear o editar una cuenta interna (C10, CU-23): campos, validación previa (RN-31) y
// envío. La API vuelve a validar todo.
import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { crearUsuarioInterno, editarUsuarioInterno } from '../servicios/administracion';
import type { CambiosCuenta, CuentaInterna, RolCuentaInterna } from '../tipos';
import { problemaContrasena } from '../utilidades/contrasena';
import { mensajeDeError } from './usuarios-internos';

export interface CamposCuenta {
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
  areas: number[];
  /** Contraseña inicial al crear; al editar, vacía si no se asigna una nueva. */
  contrasena: string;
}

export type ErroresCuenta = Partial<Record<keyof CamposCuenta | 'general', string>>;

const CAMPOS_CON_ERROR = ['nombre', 'correo', 'rol', 'areas', 'contrasena'] as const;

export function camposIniciales(cuenta: CuentaInterna | null): CamposCuenta {
  if (!cuenta) return { nombre: '', correo: '', rol: 'docente', areas: [], contrasena: '' };
  const { nombre, correo, rol, areas } = cuenta;
  return { nombre, correo, rol, areas, contrasena: '' };
}

/** Errores visibles antes de enviar. Al editar, la contraseña vacía significa que no cambia. */
export function validarCampos(campos: CamposCuenta, creando: boolean): ErroresCuenta {
  const errores: ErroresCuenta = {};
  if (campos.nombre.trim() === '') errores.nombre = 'Escribe el nombre.';
  if (creando && campos.correo.trim() === '') errores.correo = 'Escribe el correo.';
  if (campos.rol === 'docente' && campos.areas.length === 0) {
    errores.areas = 'Elige al menos un área de especialidad.';
  }
  if (creando || campos.contrasena !== '') {
    const problema = problemaContrasena(campos.contrasena, campos.correo);
    if (problema) errores.contrasena = problema;
  }
  return errores;
}

/** Un administrador no tiene áreas; las de un docente van ordenadas. */
function areasSegunRol({ rol, areas }: CamposCuenta): number[] {
  return rol === 'admin' ? [] : [...areas].sort((a, b) => a - b);
}

const mismasAreas = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/** Solo lo que cambió respecto de la cuenta guardada. */
export function armarCambios(cuenta: CuentaInterna, campos: CamposCuenta): CambiosCuenta {
  const areas = areasSegunRol(campos);
  const cambios: CambiosCuenta = {};
  if (campos.nombre.trim() !== cuenta.nombre) cambios.nombre = campos.nombre.trim();
  if (campos.rol !== cuenta.rol) cambios.rol = campos.rol;
  if (!mismasAreas(areas, cuenta.areas)) cambios.areas = areas;
  if (campos.contrasena !== '') cambios.contrasena = campos.contrasena;
  return cambios;
}

/** El error de la API va bajo el campo que indica su primer detalle, o arriba del formulario. */
export function erroresDeApi(error: unknown): ErroresCuenta {
  const { mensaje } = mensajeDeError(error);
  const detalles: unknown[] =
    error instanceof ErrorApi && Array.isArray(error.detalles) ? error.detalles : [];
  const primero = detalles[0];
  const ruta =
    typeof primero === 'object' && primero !== null && 'ruta' in primero ? primero.ruta : '';
  const campo = CAMPOS_CON_ERROR.find((c) => c === ruta);
  return campo ? { [campo]: mensaje } : { general: mensaje };
}

function guardar(cuenta: CuentaInterna | null, campos: CamposCuenta): Promise<unknown> {
  if (cuenta) return editarUsuarioInterno(cuenta.id, armarCambios(cuenta, campos));
  const { nombre, correo, rol, contrasena } = campos;
  return crearUsuarioInterno({
    nombre: nombre.trim(),
    correo: correo.trim(),
    rol,
    contrasena,
    areas: areasSegunRol(campos),
  });
}

export function useFormularioCuenta(cuenta: CuentaInterna | null, alGuardar: () => void) {
  const [campos, setCampos] = useState(() => camposIniciales(cuenta));
  const [errores, setErrores] = useState<ErroresCuenta>({});
  const [enviando, setEnviando] = useState(false);

  const cambiar = (cambios: Partial<CamposCuenta>) =>
    setCampos((actual) => ({ ...actual, ...cambios }));
  const alternarArea = (id: number) =>
    setCampos((actual) => ({
      ...actual,
      areas: actual.areas.includes(id)
        ? actual.areas.filter((a) => a !== id)
        : [...actual.areas, id],
    }));

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const previos = validarCampos(campos, cuenta === null);
    if (cuenta && Object.keys(armarCambios(cuenta, campos)).length === 0) {
      previos.general = 'No hay cambios que guardar.';
    }
    setErrores(previos);
    if (Object.keys(previos).length > 0) return;
    setEnviando(true);
    guardar(cuenta, campos).then(alGuardar, (error: unknown) => {
      setErrores(erroresDeApi(error));
      setEnviando(false);
    });
  };

  return { campos, errores, enviando, cambiar, alternarArea, enviar };
}
