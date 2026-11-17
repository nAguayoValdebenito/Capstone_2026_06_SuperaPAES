import type { ConsultaTemario } from '../tipos/temario';
import { CL, M1 } from './temario';

export const TEMARIO_CONSULTA: ConsultaTemario = {
  areas: [
    { id: 2, nombre: 'Matemática' },
    { id: 1, nombre: 'Lenguaje' },
  ],
  pruebas: [
    {
      ...M1,
      ejes: M1.ejes.map((e) => ({
        ...e,
        contenidos: e.contenidos.map((c) => ({
          ...c,
          area: { id: 2, nombre: 'Matemática' },
          curso: '1° medio',
          activo: c.id !== 110,
          descriptores: 'Resolver operaciones y problemas.\nComparar resultados.',
        })),
      })),
      habilidades: [
        { id: 30, codigo: 'MOD', nombre: 'Modelar', criterios: 'Usa modelos matemáticos.' },
      ],
    },
    {
      ...CL,
      ejes: CL.ejes.map((e) => ({
        ...e,
        contenidos: e.contenidos.map((c) => ({
          ...c,
          area: { id: 1, nombre: 'Lenguaje' },
          curso: null,
          activo: true,
          descriptores: null,
        })),
      })),
      habilidades: [{ id: 40, codigo: 'INT', nombre: 'Interpretar', criterios: null }],
    },
  ],
};
