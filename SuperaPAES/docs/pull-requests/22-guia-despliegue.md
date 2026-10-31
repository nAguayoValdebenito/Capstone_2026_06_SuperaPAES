# Guía del primer despliegue

## Alcance

Este PR agrega **solo documentación** en `operaciones/despliegue.md` y esta descripción. No cambia
código, configuración ejecutable, infraestructura ni secretos. La guía ordena el primer despliegue
en Neon, Render, Brevo, Vercel y GitHub, y separa las comprobaciones posibles de las funciones aún
pendientes.

## Qué debe configurar el responsable del despliegue

- Crear el proyecto PostgreSQL 18 en Neon, usar su conexión TLS directa, ejecutar
  `migrar:produccion` sin la semilla legal y crear el primer administrador desde una terminal local.
- Integrar la conexión IA en la rama que se publicará. En Render, configurar el Web Service Node 24
  con raíz `SuperaPAES`, build, start, salud y **28 variables explícitas**, incluido
  `NODE_ENV=production`: DeepSeek principal, Gemini de respaldo, SMTP real y tiendas en modo
  `sandbox`. Las siete variables de texto de tiendas llevan marcadores inequívocos mientras las
  compras sigan sin implementar.
- Crear y guardar por separado los secretos de las sesiones, del código de correo y del respaldo;
  obtener las claves de IA y SMTP de sus proveedores.
- Verificar el remitente y configurar Brevo SMTP con STARTTLS en el puerto 2525.
- Publicar la consola en Vercel con raíz `SuperaPAES/consola`, establecer `VITE_API_URL` y ajustar
  `URL_CONSOLA` y `CORS_ORIGENES` en Render.
- Crear los secretos `DATABASE_URL` y `CLAVE_RESPALDO` de GitHub Actions, ejecutar el primer respaldo
  manual, activar `RESPALDO_ACTIVO` y comprobar la etiqueta `incidente`.
- Verificar salud, ingreso del administrador y registro con correo real. Dejar la comprobación de
  generación de preguntas pendiente hasta que exista la ruta del generador.

## Relación con el DAS 4.5.5 (v1.20)

1. **Compras:** el DAS presupone avisos, suscripciones y conciliación con las tiendas. Este primer
   despliegue usa marcadores en las variables de tiendas porque los adaptadores aún no implementan la
   verificación de compras. Esa parte del plan de contingencia todavía no se puede ejercer.
2. **Flujos programados:** el DAS presupone respaldo diario y tareas horarias. `feat/conexion-ia` no
   contiene sus archivos porque se creó antes de que se añadieran a `main`; el diff de tres puntos no
   los elimina y una fusión de prueba desde `origin/main` conserva ambos. Se debe comprobar que sigan
   presentes al resolver la integración. La fusión de prueba encontró un conflicto en
   `SuperaPAES/api/.env.example`, no en los flujos.
3. **Generación y respaldo IA:** el DAS indica que Gemini toma el relevo si DeepSeek no tiene saldo.
   La rama IA conecta los adaptadores, pero la ruta y la pantalla del generador siguen sin implementar.
   Por eso la guía no da por superada la verificación de una pregunta generada.

## Verificación de este PR

- Los nombres de las 28 variables se contrastaron con `leerConfiguracion()` en `origin/main` y
  `feat/conexion-ia`; `GEMINI_MODELO` es la única que depende de integrar la rama IA.
- Se revisaron los comandos reales de npm, la exclusión de la semilla legal, los workflows y el DAS
  4.5.5. El archivo Markdown pasa Prettier y `git diff --check`.
