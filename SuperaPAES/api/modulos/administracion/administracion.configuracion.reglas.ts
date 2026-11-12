// HU-51: catálogo de presentación y validación. Los valores se leen siempre de la base.
import { ErrorValidacion } from '../../comun/errores.js';

type TipoValor = 'entero' | 'decimal' | 'texto';
export interface ReglaConfiguracion {
  nombre: string;
  unidad: string;
  regla: string;
  editable: boolean;
  tipo: TipoValor;
}

const EDITABLES: Record<string, Omit<ReglaConfiguracion, 'editable' | 'tipo'>> = {
  cupo_inicial: {
    nombre: 'Cupo diario sin correo verificado',
    unidad: 'preguntas',
    regla: 'RN-01',
  },
  cupo_verificado: {
    nombre: 'Cupo diario con correo verificado',
    unidad: 'preguntas',
    regla: 'RN-01',
  },
  bono_invitacion: { nombre: 'Bono por invitación', unidad: 'preguntas', regla: 'RN-03' },
  tope_invitaciones_mes: {
    nombre: 'Tope mensual de invitaciones premiadas',
    unidad: 'invitaciones',
    regla: 'RN-03',
  },
  dias_sin_repetir: {
    nombre: 'Días sin repetir una pregunta acertada',
    unidad: 'días',
    regla: 'RF-A07',
  },
  revisores_requeridos: { nombre: 'Revisores por pregunta', unidad: 'docentes', regla: 'RN-10' },
  dias_plazo_revision: { nombre: 'Plazo de revisión docente', unidad: 'días', regla: 'RF-G17' },
  repaso_sin_plan: {
    nombre: 'Repaso sin plan Todas las pruebas',
    unidad: 'preguntas',
    regla: 'RN-04, RN-05',
  },
  min_respuestas_eje: {
    nombre: 'Respuestas mínimas para reforzar un eje',
    unidad: 'respuestas',
    regla: 'RN-14',
  },
  umbral_eje_debil: { nombre: 'Umbral de eje a reforzar', unidad: '%', regla: 'RN-14' },
  horas_inactividad_practica: {
    nombre: 'Cierre de práctica sin actividad',
    unidad: 'horas',
    regla: 'RN-19',
  },
  max_preguntas_lote: {
    nombre: 'Preguntas por solicitud a la IA',
    unidad: 'preguntas',
    regla: 'CU-17',
  },
  tope_diario_ia: { nombre: 'Tope diario de generación', unidad: 'preguntas', regla: 'RNF-03' },
  tope_mensual_ia_usd: { nombre: 'Tope mensual de gasto en IA', unidad: 'US$', regla: 'RNF-03' },
  plazo_derechos_dias: {
    nombre: 'Plazo de solicitudes de datos',
    unidad: 'días corridos',
    regla: 'RF-A21, RNF-09',
  },
};

const SOLO_LECTURA: Record<string, Omit<ReglaConfiguracion, 'editable' | 'tipo'>> = {
  modelo_ia: { nombre: 'Modelo de IA', unidad: '', regla: 'RF-G03' },
  temperatura_ia_deepseek: { nombre: 'Temperatura DeepSeek', unidad: '', regla: 'RF-G03' },
  temperatura_ia_gemini: { nombre: 'Temperatura Gemini', unidad: '', regla: 'RF-G03' },
  precio_entrada_ia_deepseek: {
    nombre: 'Precio de entrada DeepSeek',
    unidad: 'US$/millón de tokens',
    regla: 'RNF-03',
  },
  precio_salida_ia_deepseek: {
    nombre: 'Precio de salida DeepSeek',
    unidad: 'US$/millón de tokens',
    regla: 'RNF-03',
  },
  precio_entrada_ia_gemini: {
    nombre: 'Precio de entrada Gemini',
    unidad: 'US$/millón de tokens',
    regla: 'RNF-03',
  },
  precio_salida_ia_gemini: {
    nombre: 'Precio de salida Gemini',
    unidad: 'US$/millón de tokens',
    regla: 'RNF-03',
  },
  concurrencia_ia: { nombre: 'Concurrencia de IA', unidad: 'preguntas', regla: 'CU-17' },
};

export function reglaConfiguracion(clave: string): ReglaConfiguracion | null {
  const editable = EDITABLES[clave];
  if (editable)
    return {
      ...editable,
      editable: true,
      tipo: clave === 'tope_mensual_ia_usd' ? 'decimal' : 'entero',
    };
  const lectura = SOLO_LECTURA[clave];
  if (lectura)
    return { ...lectura, editable: false, tipo: clave === 'modelo_ia' ? 'texto' : 'decimal' };
  return null;
}

function valorInvalido(mensaje: string): never {
  throw new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'valor', mensaje }], mensaje);
}

/** Sin límites máximos inventados. Solo el porcentaje tiene rango documentado. */
function validarTipo(regla: ReglaConfiguracion, valor: unknown): asserts valor is number {
  if (typeof valor !== 'number' || !Number.isFinite(valor))
    valorInvalido('Escribe un número válido.');
  if (regla.tipo === 'entero' && !Number.isSafeInteger(valor))
    valorInvalido('Escribe un número entero.');
}

function validarLimite(clave: string, regla: ReglaConfiguracion, valor: number): void {
  if (clave === 'umbral_eje_debil') {
    if (valor < 0 || valor > 100) valorInvalido('El porcentaje debe estar entre 0 y 100.');
  } else if (valor <= 0) valorInvalido('El valor debe ser mayor que cero.');
  if (regla.tipo === 'decimal' && !/^\d+(\.\d{1,2})?$/.test(String(valor))) {
    valorInvalido('Usa como máximo dos decimales.');
  }
}

export function validarValorConfiguracion(clave: string, valor: unknown): number {
  const regla = reglaConfiguracion(clave);
  if (!regla?.editable) valorInvalido('Este parámetro no se puede editar desde la consola.');
  validarTipo(regla, valor);
  validarLimite(clave, regla, valor);
  return valor;
}
