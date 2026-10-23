// Lectura en la terminal de los comandos de una sola vez: la contraseña no se muestra.
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { type EntradaTerminal, preguntar } from '../scripts/terminal.js';

function crearTerminal(isTTY = true) {
  const emisor = new EventEmitter();
  const modos: boolean[] = [];
  let mostrado = '';
  const entrada: EntradaTerminal = {
    isTTY,
    setRawMode: (modo) => modos.push(modo),
    setEncoding: () => undefined,
    resume: () => undefined,
    pause: () => undefined,
    on: (evento, escucha) => emisor.on(evento, escucha),
    off: (evento, escucha) => emisor.off(evento, escucha),
  };
  const salida = { write: (texto: string) => (mostrado += texto) };
  const teclear = (texto: string) => emisor.emit('data', texto);
  return { entrada, salida, teclear, modos, mostrado: () => mostrado };
}

describe('preguntar', () => {
  it('lee una línea visible, con borrado', async () => {
    const t = crearTerminal();
    const respuesta = preguntar(t.entrada, t.salida, 'Nombre: ');
    t.teclear('Anx\u007fa\r');

    expect(await respuesta).toBe('Ana');
    expect(t.mostrado()).toBe('Nombre: Anx\b \ba\n');
    expect(t.modos).toEqual([true, false]);
  });

  it('con oculta, la contraseña no aparece en la pantalla', async () => {
    const t = crearTerminal();
    const respuesta = preguntar(t.entrada, t.salida, 'Contraseña: ', true);
    t.teclear('clave-sec');
    t.teclear('reta\r');

    expect(await respuesta).toBe('clave-secreta');
    expect(t.mostrado()).toBe('Contraseña: \n');
  });

  it('Ctrl+C cancela y deja la terminal como estaba', async () => {
    const t = crearTerminal();
    const respuesta = preguntar(t.entrada, t.salida, 'Correo: ');
    t.teclear('a\u0003');

    await expect(respuesta).rejects.toThrow('Cancelado.');
    expect(t.modos).toEqual([true, false]);
  });

  it('exige una terminal interactiva', async () => {
    const t = crearTerminal(false);

    await expect(preguntar(t.entrada, t.salida, 'Contraseña: ', true)).rejects.toThrow(
      /terminal interactiva/,
    );
  });
});
