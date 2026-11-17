import { describe, expect, it } from 'vitest';
import { ErrorApi } from '../api/cliente';
import type { CuentaInterna } from '../tipos';
import {
  armarCambios,
  camposIniciales,
  erroresDeApi,
  validarCampos,
  type CamposCuenta,
} from './formulario-cuenta';

const cuenta: CuentaInterna = {
  id: '3',
  nombre: 'Diego Docente',
  correo: 'diego@ejemplo.cl',
  rol: 'docente',
  activo: true,
  areas: [1, 2],
  creadoEn: '2026-10-23T12:00:00.000Z',
  ultimoAcceso: null,
};

const nueva = (cambios: Partial<CamposCuenta> = {}): CamposCuenta => ({
  nombre: 'Ana',
  correo: 'ana@ejemplo.cl',
  rol: 'docente',
  areas: [1],
  contrasena: 'clave-inicial',
  ...cambios,
});

describe('validarCampos', () => {
  it('al crear exige nombre, correo, áreas del docente y una contraseña que cumpla RN-31', () => {
    expect(validarCampos(nueva(), true)).toEqual({});
    expect(
      Object.keys(
        validarCampos(nueva({ nombre: ' ', correo: '', areas: [], contrasena: 'corta' }), true),
      ),
    ).toEqual(['nombre', 'correo', 'areas', 'contrasena']);
  });

  it('un administrador no necesita áreas', () => {
    expect(validarCampos(nueva({ rol: 'admin', areas: [] }), true)).toEqual({});
  });

  it('al editar, la contraseña vacía significa que no cambia', () => {
    expect(validarCampos(camposIniciales(cuenta), false)).toEqual({});
    const igualAlCorreo = { ...camposIniciales(cuenta), contrasena: 'DIEGO@ejemplo.cl' };
    expect(validarCampos(igualAlCorreo, false).contrasena).toMatch(/igual al correo/);
  });
});

describe('armarCambios', () => {
  it('envía solo lo que cambió', () => {
    expect(armarCambios(cuenta, camposIniciales(cuenta))).toEqual({});
    expect(
      armarCambios(cuenta, {
        ...camposIniciales(cuenta),
        nombre: 'Diego D. ',
        areas: [2, 3, 1],
        contrasena: 'nueva-clave',
      }),
    ).toEqual({ nombre: 'Diego D.', areas: [1, 2, 3], contrasena: 'nueva-clave' });
  });

  it('al pasar a administrador quita las áreas', () => {
    expect(armarCambios(cuenta, { ...camposIniciales(cuenta), rol: 'admin' })).toEqual({
      rol: 'admin',
      areas: [],
    });
  });
});

describe('erroresDeApi', () => {
  it('muestra el error bajo el campo que indica la API, o arriba del formulario', () => {
    const deCampo = new ErrorApi(400, 'VALIDACION', 'Muy corta', [{ ruta: 'contrasena' }]);
    const conflicto = new ErrorApi(
      409,
      'CONFLICTO',
      'Ya existe una cuenta interna con ese correo.',
    );

    expect(erroresDeApi(deCampo)).toEqual({ contrasena: 'Muy corta' });
    expect(erroresDeApi(conflicto)).toEqual({
      general: 'Ya existe una cuenta interna con ese correo.',
    });
  });
});
