// Reloj inyectable: las reglas que dependen de la hora reciben un Reloj para poder probarlas con una hora fija.

export type Reloj = () => Date;

export const relojDelSistema: Reloj = () => new Date();
