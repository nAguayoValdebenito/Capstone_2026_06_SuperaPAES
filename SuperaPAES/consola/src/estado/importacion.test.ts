// Reglas de la pantalla de importación (C04, HU-13.2): qué archivos se envían a revisar, cuándo se
// confirma (RN-29) y el aviso al volver al banco.
import { describe, expect, it } from 'vitest';
import type { InformeImportacion } from '../tipos';
import {
  avisoDeImportacion,
  esCsv,
  PESO_MAXIMO,
  pesaDemasiado,
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
  const archivos = (contenido: string) => ({
    preguntas: { nombre: 'preguntas.csv', contenido },
    textos: null,
  });

  it('solo se envían archivos CSV, sin mirar mayúsculas', () => {
    expect(esCsv('Preguntas.CSV')).toBe(true);
    expect(esCsv('preguntas.xlsx')).toBe(false);
    expect(esCsv('preguntas.csv.txt')).toBe(false);
  });

  it('la petición con los archivos y la declaración cabe en el límite de la API', () => {
    expect(pesaDemasiado(archivos('a;b\n1;2\n'))).toBe(false);
    expect(pesaDemasiado(archivos('x'.repeat(PESO_MAXIMO)))).toBe(true);
  });

  it('cuenta los bytes de la petición, no las letras: las tildes ocupan dos', () => {
    const casiAlLimite = PESO_MAXIMO - 200;
    expect(pesaDemasiado(archivos('a'.repeat(casiAlLimite)))).toBe(false);
    expect(pesaDemasiado(archivos('á'.repeat(casiAlLimite)))).toBe(true);
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
    expect(puedeConfirmar({ tipo: 'rechazada', mensaje: 'x' }, true, false)).toBe(false);
    expect(puedeConfirmar(lista(), true, true)).toBe(false);
  });

  it('el aviso del banco dice cuántas quedaron como borrador', () => {
    expect(avisoDeImportacion(1)).toBe('Se importó 1 pregunta como borrador.');
    expect(avisoDeImportacion(12)).toBe('Se importaron 12 preguntas como borrador.');
  });
});
