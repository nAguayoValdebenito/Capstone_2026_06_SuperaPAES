export const GRUPOS_CONFIGURACION = [
  {
    titulo: 'Cupos e invitaciones',
    claves: ['cupo_inicial', 'cupo_verificado', 'bono_invitacion', 'tope_invitaciones_mes'],
  },
  {
    titulo: 'Revisión docente',
    claves: ['revisores_requeridos', 'dias_plazo_revision'],
  },
  {
    titulo: 'Práctica y progreso',
    claves: [
      'dias_sin_repetir',
      'repaso_sin_plan',
      'min_respuestas_eje',
      'umbral_eje_debil',
      'horas_inactividad_practica',
    ],
  },
  {
    titulo: 'Generación con IA',
    claves: [
      'max_preguntas_lote',
      'tope_diario_ia',
      'tope_mensual_ia_usd',
      'modelo_ia',
      'temperatura_ia_deepseek',
      'temperatura_ia_gemini',
      'precio_entrada_ia_deepseek',
      'precio_salida_ia_deepseek',
      'precio_entrada_ia_gemini',
      'precio_salida_ia_gemini',
      'concurrencia_ia',
    ],
  },
  { titulo: 'Solicitudes de datos', claves: ['plazo_derechos_dias'] },
] as const;
