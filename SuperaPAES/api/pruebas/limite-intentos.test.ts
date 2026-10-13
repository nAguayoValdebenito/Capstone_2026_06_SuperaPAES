// Modos del límite de intentos, sobre una app mínima con rutas que siempre responden bien o mal.
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  crearFabricaLimiteIntentos,
  type UsoLimiteIntentos,
} from '../comun/middleware/limite-intentos.js';
import { manejarErrores } from '../comun/middleware/manejo-errores.js';

const crearLimite = crearFabricaLimiteIntentos({ ventanaMs: 60_000, maximo: 2 });

/** Simula que autenticarApp ya identificó al estudiante del encabezado X-Estudiante. */
const estudianteDePrueba: RequestHandler = (req, _res, next) => {
  const id = req.header('X-Estudiante');
  if (id) req.estudiante = { id };
  next();
};

function crearAppDePrueba(uso: UsoLimiteIntentos, estado: number) {
  const app = express();
  app.use(estudianteDePrueba);
  app.post('/accion', crearLimite(uso), (_req, res) => {
    res.status(estado).end();
  });
  app.use(manejarErrores);
  return app;
}

async function intentar(app: express.Express, veces: number, estudiante?: string) {
  let ultima = 0;
  for (let i = 0; i < veces; i++) {
    const peticion = request(app).post('/accion');
    ultima = (await (estudiante ? peticion.set('X-Estudiante', estudiante) : peticion)).status;
  }
  return ultima;
}

describe('límite de intentos', () => {
  it('por defecto cuenta también las respuestas exitosas (registro, recuperación)', async () => {
    expect(await intentar(crearAppDePrueba({}, 202), 3)).toBe(429);
  });

  it('con soloFallidos las respuestas exitosas no cuentan (ingreso)', async () => {
    expect(await intentar(crearAppDePrueba({ soloFallidos: true }, 200), 5)).toBe(200);
  });

  it('con soloFallidos los fallos sí cuentan', async () => {
    expect(await intentar(crearAppDePrueba({ soloFallidos: true }, 401), 3)).toBe(429);
  });

  it('con porEstudiante cada estudiante tiene su propio contador aunque compartan IP', async () => {
    const app = crearAppDePrueba({ porEstudiante: true }, 201);

    expect(await intentar(app, 3, 'ana')).toBe(429);
    expect(await intentar(app, 1, 'diego')).toBe(201);
  });
});
