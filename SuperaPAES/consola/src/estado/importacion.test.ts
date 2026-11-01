// Reglas de la pantalla de importación (C04, HU-13.2): qué archivos se envían a revisar, cuándo se
// confirma (RN-29) y el aviso al volver al banco.
import { describe, expect, it } from 'vitest';
import type { InformeImportacion } from '../tipos';
import {
  avisoDeImportacion,
  PESO_MAXIMO,
  problemaDeLosArchivos,
  puedeConfirmar,
  type RevisionImportacion,
} from './importacion';

const informe = (cambios: Partial<InformeImportacion> = {}): InformeImportacion => ({
  filasLeidas: 3,
  porCrear: 2,
  omitidas: 0,
  conError: 1,
  textosPorCrear: 0,
  errores: [],
  ...cambios,
});

const lista = (cambios: Partial<InformeImportacion> = {}): RevisionImportacion => ({
  tipo: 'lista',
  informe: informe(cambios),
  archivos: { preguntas: { nombre: 'preguntas.csv', contenido: '' }, textos: null },
});

describe('archivos de la importación', () => {
  it('acepta CSV que juntos pesan hasta el máximo', () => {
    expect(problemaDeLosArchivos([{ name: 'Preguntas.CSV', size: PESO_MAXIMO }])).toBeNull();
  });

  it('pide guardar la planilla como CSV si el archivo es otro', () => {
    expect(problemaDeLosArchivos([{ name: 'preguntas.xlsx', size: 10 }])).toBe(
      'Elige archivos CSV. En Excel, guarda la planilla como «CSV UTF-8 (delimitado por comas)».',
    );
  });

  it('pide dividir las preguntas si los dos archivos pasan del máximo', () => {
    const mitad = PESO_MAXIMO / 2;
    expect(
      problemaDeLosArchivos([
        { name: 'preguntas.csv', size: mitad },
        { name: 'textos.csv', size: mitad + 1 },
      ]),
    ).toBe('Los archivos pesan más de 900 KB en total: divide las preguntas en varios archivos.');
  });
});

describe('confirmar la importación (CU-16 paso 6, RN-29)', () => {
  it('solo con la declaración del origen y al menos una pregunta por crear', () => {
    expect(puedeConfirmar(lista(), true, false)).toBe(true);
    expect(puedeConfirmar(lista(), false, false)).toBe(false);
    expect(puedeConfirmar(lista({ porCrear: 0 }), true, false)).toBe(false);
  });

  it('no mientras se revisa, si el archivo se rechazó o mientras se importa', () => {
    expect(puedeConfirmar({ tipo: 'revisando' }, true, false)).toBe(false);
    expect(puedeConfirmar({ tipo: 'rechazada', codigo: 'X', mensaje: 'x' }, true, false)).toBe(
      false,
    );
    expect(puedeConfirmar(lista(), true, true)).toBe(false);
  });

  it('el aviso del banco dice cuántas quedaron como borrador', () => {
    expect(avisoDeImportacion(1)).toBe('Se importó 1 pregunta como borrador.');
    expect(avisoDeImportacion(12)).toBe('Se importaron 12 preguntas como borrador.');
  });
});
