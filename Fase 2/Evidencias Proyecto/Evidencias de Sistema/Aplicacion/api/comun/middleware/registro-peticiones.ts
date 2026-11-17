// Registra cada petición en una línea JSON. No registra la consulta (?...) porque puede llevar tokens.
import type { RequestHandler } from 'express';
import { registro } from '../registro.js';

export const registrarPeticiones: RequestHandler = (req, res, next) => {
  const inicio = performance.now();
  res.on('finish', () => {
    registro.info('Petición', {
      metodo: req.method,
      ruta: req.baseUrl + req.path,
      estado: res.statusCode,
      duracionMs: Math.round(performance.now() - inicio),
    });
  });
  next();
};
