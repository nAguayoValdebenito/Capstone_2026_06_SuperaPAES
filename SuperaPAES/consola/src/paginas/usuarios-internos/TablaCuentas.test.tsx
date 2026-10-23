import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CuentaInterna } from '../../tipos';
import { TablaCuentas } from './TablaCuentas';

const cuenta = (id: string, activo = true): CuentaInterna => ({
  id,
  nombre: `Admin ${id}`,
  correo: `admin${id}@ejemplo.cl`,
  rol: 'admin',
  activo,
  areas: [],
  creadoEn: '2026-10-23T12:00:00.000Z',
  ultimoAcceso: null,
});
const nada = () => undefined;

describe('tabla de C10', () => {
  it('no ofrece desactivar la propia cuenta (CU-23 3.c), sí las demás', () => {
    const html = renderToString(
      <TablaCuentas
        cuentas={[cuenta('1'), cuenta('2')]}
        areas={[]}
        alEditar={nada}
        alAlternarEstado={nada}
        idPropio="1"
      />,
    );

    expect(html.match(/>Desactivar</g)).toHaveLength(1);
    expect(html.match(/>Editar</g)).toHaveLength(2);
  });
});
