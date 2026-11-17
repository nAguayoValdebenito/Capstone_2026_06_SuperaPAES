// Lectura del Markdown de los textos legales (HU-34.4): título, subtítulos, párrafos y listas.
import { describe, expect, it } from 'vitest';
import { bloquesDe } from './markdown';

describe('bloques de un texto legal', () => {
  it('separa título, subtítulos, párrafos de varias líneas y listas', () => {
    const texto = [
      '# Términos y condiciones',
      '',
      'Versión 1.0. Vigente desde 19/10/2026.',
      '',
      '## 1. Quiénes somos',
      'Supera PAES es un servicio',
      'para practicar la PAES.',
      '- Tener 14 años o más.',
      '- Usar una sola cuenta.',
      '',
      '## 2. El servicio',
    ].join('\r\n');

    expect(bloquesDe(texto)).toEqual([
      { tipo: 'titulo', texto: 'Términos y condiciones' },
      { tipo: 'parrafo', texto: 'Versión 1.0. Vigente desde 19/10/2026.' },
      { tipo: 'subtitulo', texto: '1. Quiénes somos' },
      { tipo: 'parrafo', texto: 'Supera PAES es un servicio para practicar la PAES.' },
      { tipo: 'lista', items: ['Tener 14 años o más.', 'Usar una sola cuenta.'] },
      { tipo: 'subtitulo', texto: '2. El servicio' },
    ]);
  });

  it('un párrafo entre dos listas las deja separadas', () => {
    expect(bloquesDe('- uno\nTexto\n- dos')).toEqual([
      { tipo: 'lista', items: ['uno'] },
      { tipo: 'parrafo', texto: 'Texto' },
      { tipo: 'lista', items: ['dos'] },
    ]);
  });

  it('como en la app, lo demás queda como texto, sin interpretar HTML', () => {
    expect(bloquesDe('### Tres\n* asterisco\n<script>alerta()</script> y **negrita**')).toEqual([
      { tipo: 'parrafo', texto: '### Tres * asterisco <script>alerta()</script> y **negrita**' },
    ]);
  });
});
