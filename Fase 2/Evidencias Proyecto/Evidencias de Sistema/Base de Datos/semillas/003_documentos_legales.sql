-- Supera PAES. Documentos legales, versión 1.0 (modelo de datos 11.0).
-- Se ejecuta después de los datos iniciales. Carga la versión 1.0 de los Términos y condiciones, de la Política de privacidad
-- y del permiso para usar los puntajes PAES (RN-16, RN-27, RN-30), en Markdown, tal como los muestran la app y la consola.
-- Correo de contacto: superapaes@gmail.com. Vigencia de la versión 1.0: 19/10/2026 (hora de Chile).
-- Antes de cargarlo en la base publicada se reemplaza «dirección de la consola» por la dirección real, y el texto lo revisa
-- un docente o el cliente (RN-30). Las versiones siguientes las publica el administrador desde la consola.
BEGIN;

INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde)
SELECT t.id, '1.0', $doc$# Términos y condiciones

Versión 1.0. Vigente desde 19/10/2026.

## 1. Quiénes somos

Supera PAES es un servicio para practicar la Prueba de Acceso a la Educación Superior (PAES) de Chile, ofrecido por Aprueba, representada por Sebastián Pérez (en adelante, «Aprueba»). Se usa por medio de la app Supera PAES para Android y iPhone. Puedes escribirnos a superapaes@gmail.com.

Al crear tu cuenta aceptas estos términos y la Política de privacidad. Si no estás de acuerdo con ellos, no crees una cuenta.

## 2. El servicio

Supera PAES te permite practicar preguntas de Competencia Lectora, Matemática 1 (M1), Matemática 2 (M2), Ciencias e Historia y Ciencias Sociales, según el temario oficial que publica el DEMRE. Incluye práctica personalizada, diagnóstico, mini-ensayos, ensayos completos, repaso de errores y seguimiento de tu progreso, según el plan que tengas.

Las preguntas son propias de Supera PAES: se generan con apoyo de inteligencia artificial y cada una la revisan dos docentes especialistas del área antes de publicarse, o provienen de un banco con permiso de uso. Supera PAES no usa los facsímiles del DEMRE ni otro material protegido.

Supera PAES no pertenece ni está asociado al DEMRE ni a la Universidad de Chile. Del DEMRE solo usa información pública: el temario, la estructura de cada prueba y las tablas de conversión de puntajes.

Puntaje estimado. Solo el ensayo completo entrega un puntaje estimado de 100 a 1.000, calculado con la tabla de conversión oficial más reciente de esa prueba, cuyo año y proceso de admisión se indican en el resultado. Es una estimación para orientar tu preparación y no es un resultado oficial del DEMRE. Supera PAES no garantiza un puntaje en la PAES ni el ingreso a una carrera.

## 3. Edad mínima

Para crear una cuenta debes tener 14 años o más. Al aceptar estos términos declaras tener esa edad. Las personas menores de 14 años no pueden registrarse, porque necesitarían la autorización de sus padres, que esta versión del servicio no gestiona.

## 4. Tu cuenta

Puedes tener una sola cuenta, con tu nombre y un correo que uses. La contraseña debe tener de 8 a 72 caracteres y no puede ser una contraseña muy común ni igual a tu correo. Eres responsable de mantenerla en reserva y de lo que se haga con tu cuenta; si crees que otra persona la conoce, cámbiala con la opción de recuperar contraseña y avísanos.

Al registrarte te enviamos un correo para verificar tu dirección, con un enlace y un código de 6 dígitos. Verificar el correo sube tu cupo diario de 10 a 20 preguntas.

Si usas la app en un teléfono que comparten otras personas, cierra tu sesión al terminar.

## 5. Cupo diario, bonos e invitaciones

Con el plan Gratis puedes responder 10 preguntas al día, o 20 con el correo verificado. El cupo es común a todas las pruebas y se reinicia a las 00:00, hora de Chile. Los diagnósticos, los mini-ensayos, los ensayos completos y el repaso de errores no descuentan cupo, y tampoco las preguntas de las pruebas cubiertas por tu suscripción.

Cada estudiante tiene un código de invitación. Cuando una persona se registra con tu código y verifica su correo, recibes 5 preguntas de bono. Los bonos se usan cuando se acaba el cupo del día, se acumulan, no vencen y tienen un tope mensual de invitaciones premiadas. Los bonos no tienen valor en dinero y no se pueden transferir ni canjear.

Si una cuenta se crea con datos falsos o con correos propios para obtener bonos, Aprueba puede anular los bonos obtenidos de esa forma.

## 6. Planes y pagos

Supera PAES ofrece los siguientes planes:

- Gratis: cupo diario de preguntas, un mini-ensayo al mes por prueba y repaso de hasta 10 preguntas falladas, las más recientes.
- Una prueba: $1.990 al mes o $15.990 al año. Práctica y mini-ensayos sin límite en la prueba elegida.
- Todas las pruebas: $2.990 al mes o $23.990 al año. Práctica y mini-ensayos sin límite en todas las pruebas, ensayos completos con puntaje estimado y repaso de todas las preguntas falladas.

El seguimiento del progreso es el mismo en todos los planes: las suscripciones solo agregan más preguntas y evaluaciones.

Los precios son en pesos chilenos, con los impuestos incluidos, y son los mismos en Google Play y en la App Store. La compra y el cobro los hace la tienda con tu cuenta de Google Play o de la App Store, según sus propias condiciones. Aprueba no recibe ni guarda los datos de tu tarjeta ni de tu medio de pago. Si eres menor de 18 años, la compra queda sujeta a las reglas de la tienda para cuentas de menores de edad.

Renovación. Las suscripciones se renuevan automáticamente al final de cada mes o de cada año hasta que las canceles. En el plan anual te avisamos por correo 7 días antes de cada renovación.

Cancelación. Puedes cancelar la suscripción en cualquier momento desde la gestión de suscripciones de Google Play o de la App Store; la app te ofrece abrirla desde tu perfil. La app no puede cancelar la suscripción por ti, porque eso solo lo hace la tienda. Al cancelar, mantienes los beneficios hasta el final del período que ya pagaste.

Cambio de plan. Puedes cambiar de plan desde Mi suscripción. La tienda aplica el cambio y el ajuste del cobro según sus reglas.

Pago rechazado. Si la tienda no puede cobrar la renovación, la suscripción queda en mora durante el plazo que da la tienda para regularizar el pago, y mantienes los beneficios mientras tanto. Si el pago no se regulariza, la suscripción vence y vuelves al plan Gratis, sin perder tu progreso.

Devoluciones. Las devoluciones se rigen por las políticas de Google Play y de la App Store, sin perjuicio de los derechos que te reconoce la Ley 19.496 sobre protección de los derechos de los consumidores.

Cambios de precio. Si un precio cambia, se informa con anticipación y la tienda pide tu aceptación cuando sus reglas lo exigen. El cambio no afecta el período que ya pagaste.

Versión de prueba. Mientras Supera PAES se distribuye por la prueba cerrada de Google Play y por TestFlight, las compras se hacen en el modo de prueba de cada tienda y no generan cobros reales.

## 7. Uso permitido

Supera PAES es para tu estudio personal. No está permitido:

- Copiar, publicar, vender o distribuir las preguntas, las explicaciones o los textos de lectura, total o parcialmente.
- Extraer contenido de forma automatizada o acceder al servicio por medios distintos de la app y la consola.
- Usar la cuenta de otra persona, compartir tu cuenta o crear varias cuentas para obtener más cupo o bonos.
- Intentar acceder a datos o funciones que no te corresponden, alterar el funcionamiento del servicio o probar su seguridad sin autorización de Aprueba.
- Usar el servicio para fines contrarios a la ley.

## 8. Propiedad intelectual

Las preguntas, las explicaciones, los textos de lectura, el diseño, el logo y el software de Supera PAES pertenecen a Aprueba o se usan con permiso de sus titulares. Aprueba te da un permiso personal, gratuito o asociado a tu plan, no exclusivo e intransferible para usarlos dentro del servicio mientras tengas tu cuenta.

## 9. Errores en las preguntas

Aunque cada pregunta la revisan dos docentes, puede contener un error. Si encuentras uno, escríbenos a superapaes@gmail.com. Si una pregunta se anula por un error, los resultados de las evaluaciones donde apareció se recalculan sin ella.

## 10. Disponibilidad y cambios del servicio

Aprueba procura que Supera PAES funcione de forma continua, pero puede haber interrupciones por mantención, fallas de los proveedores o causas ajenas. Aprueba puede mejorar o cambiar funciones del servicio; los cambios no reducen lo que incluye un plan pagado durante el período ya pagado.

## 11. Responsabilidad

Supera PAES es un apoyo para tu preparación y no reemplaza la enseñanza de tu establecimiento ni otras formas de estudio. Aprueba responde por el servicio según la ley chilena. Nada en estos términos limita los derechos que la Ley 19.496 te reconoce como consumidor, que son irrenunciables.

## 12. Término de la cuenta

Puedes borrar tu cuenta cuando quieras desde Perfil, Mis datos, Borrar mi cuenta. Si tienes una suscripción activa o en mora, antes de borrar la cuenta debes cancelarla en la tienda, porque la tienda seguirá cobrando hasta que la canceles. Lo que pasa con tus datos al borrar la cuenta se explica en la Política de privacidad.

## 13. Cambios a estos términos

Los términos se numeran como versión mayor.menor. Un cambio menor (por ejemplo, de 1.0 a 1.1) se te informa con un aviso en la app. Un cambio mayor (por ejemplo, de 1.0 a 2.0) debes aceptarlo para seguir usando la app: al iniciar sesión verás los cambios y podrás aceptarlos. Si no estás de acuerdo, puedes dejar de usar la app y pedir el borrado de tu cuenta como indica la Política de privacidad.

## 14. Ley aplicable y reclamos

Estos términos se rigen por la ley chilena. Puedes hacer tus consultas y reclamos a superapaes@gmail.com. También puedes acudir al Servicio Nacional del Consumidor (SERNAC) o a los tribunales competentes según la Ley 19.496.
$doc$, '2026-10-19 00:00:00-03'::timestamptz
FROM contenido.tipo_documento_legal t WHERE t.codigo = 'terminos'
ON CONFLICT (tipo_documento_legal_id, version) DO NOTHING;

INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde)
SELECT t.id, '1.0', $doc$# Política de privacidad

Versión 1.0. Vigente desde 19/10/2026.

## 1. Responsable de tus datos

El responsable de tus datos personales es Aprueba, representada por Sebastián Pérez. Para cualquier consulta o solicitud sobre tus datos escribe a superapaes@gmail.com.

Esta política se rige por la Ley 19.628 sobre protección de la vida privada, con las modificaciones de la Ley 21.719, que regula la protección y el tratamiento de los datos personales.

## 2. Qué datos tratamos

Supera PAES pide solo los datos que necesita para funcionar:

- Cuenta: nombre, correo, contraseña (guardada con un hash que nadie puede leer, ni siquiera el equipo de Supera PAES), si verificaste el correo, la fecha de creación, y la versión de los términos y de la política que aceptaste con su fecha, junto con tu declaración de tener 14 años o más.
- Perfil de estudio: tu curso o el año en que egresaste, las pruebas que rendirás y el electivo de Ciencias. De forma opcional, la prueba que quieres reforzar y hasta tres áreas de carrera de interés.
- Actividad: las prácticas y evaluaciones que haces, tus respuestas, tus resultados, tu progreso por eje y habilidad, tu racha y el cupo que usas.
- Invitaciones: tu código de invitación, quiénes se registraron con él y los bonos que recibiste.
- Suscripción: tu plan, su periodicidad, su estado y su historial de cambios, y los avisos de compra que envía la tienda. No incluye datos de tarjetas ni de medios de pago, que trata solo la tienda.
- Puntajes PAES: los puntajes reales que quieras declarar, solo si das un permiso aparte (punto 4).
- Solicitudes y consultas: lo que nos escribes al pedir algo sobre tus datos o al hacer una consulta.
- Registros técnicos: los servicios en la nube que alojan Supera PAES registran datos técnicos de cada conexión, como la fecha, la hora y la dirección IP, que se usan solo para la seguridad y para resolver fallas.

Supera PAES no pide tu RUT, tu dirección, tu teléfono, tu ubicación, tus contactos ni tus fotos, y no trata datos sensibles, como los de salud.

## 3. Para qué usamos tus datos

- Crear y mantener tu cuenta y prestarte el servicio: práctica, evaluaciones, resultados, progreso, cupo y bonos. La base es el contrato que aceptas al registrarte.
- Personalizar tu práctica según tu curso y tus ejes más débiles. Son sugerencias de estudio; Supera PAES no toma decisiones automatizadas que produzcan efectos jurídicos sobre ti.
- Enviarte los correos del servicio: verificación de la cuenta, recuperación de la contraseña, aviso 7 días antes de la renovación anual, aviso de pago rechazado y respuestas a tus solicitudes. Supera PAES no envía publicidad.
- Gestionar tu suscripción con Google Play o la App Store.
- Elaborar estadísticas agregadas, que no identifican a nadie, para mejorar las preguntas y el servicio, por ejemplo el porcentaje de acierto de cada pregunta.
- Usar tus puntajes PAES en métricas agregadas, solo con tu permiso.
- Proteger el servicio y tus datos, prevenir abusos (por ejemplo, con los bonos de invitación) y mantener respaldos. La base es el interés legítimo de mantener un servicio seguro.
- Cumplir las obligaciones que fija la ley.

Supera PAES no vende tus datos, no los usa para publicidad y no los entrega a terceros para sus propios fines.

## 4. Puntajes PAES

Cargar tus puntajes PAES reales es opcional y requiere un permiso específico. Los puntajes se usan solo en métricas agregadas que no te identifican. Puedes retirar el permiso cuando quieras desde Mis datos; al retirarlo, tus puntajes se eliminan y dejan de usarse.

## 5. Quién más trata tus datos

Para funcionar, Supera PAES usa servicios externos que tratan los datos por encargo de Aprueba y solo para prestar el servicio:

- Neon: base de datos donde se guardan los datos.
- Render: servidor que procesa las solicitudes de la app y de la consola.
- Vercel: consola web y páginas públicas (términos, privacidad, invitación y enlaces de los correos).
- El servicio de correo de la cuenta del proyecto: envío de los correos del servicio.
- GitHub: ejecución del respaldo diario cifrado de la base de datos.
- Google Play y App Store: compra, cobro y gestión de las suscripciones. Tratan los datos de pago según sus propias políticas de privacidad.

Los servicios de inteligencia artificial que ayudan a generar las preguntas no reciben ningún dato de los estudiantes.

Dentro del equipo, solo el administrador puede ver el nombre y el correo de un estudiante, para darle soporte o confirmar su cuenta cuando el correo de verificación no llega. Los docentes no ven datos personales de los estudiantes, solo estadísticas agregadas de las preguntas.

Aprueba solo entrega datos a una autoridad cuando la ley lo exige.

## 6. Datos fuera de Chile

Los servicios externos del punto 5 pueden guardar o procesar los datos fuera de Chile, por ejemplo en Estados Unidos. Aprueba los elige porque aplican medidas de seguridad y condiciones de protección de datos, y la transferencia se hace según lo que exige la ley chilena.

## 7. Cuánto tiempo guardamos tus datos

- Los datos de tu cuenta y tu actividad se guardan mientras tengas tu cuenta.
- Al borrar tu cuenta se eliminan tu nombre y tu correo, y tus evaluaciones con sus respuestas y el historial de tu suscripción quedan seudonimizados: se conservan sin ningún dato que te identifique, para las estadísticas agregadas y para el registro de los avisos de la tienda.
- Las copias del respaldo diario se guardan 30 días; pasado ese plazo, los datos borrados tampoco quedan en los respaldos.
- El enlace y el código de verificación vencen a las 24 horas, y el enlace de recuperación de la contraseña, a la hora.
- Tus puntajes PAES se guardan hasta que retires el permiso o borres tu cuenta.
- Los registros técnicos se guardan por el tiempo limitado que fija cada proveedor.
- El registro de las solicitudes sobre datos se conserva para acreditar que se respondieron.

## 8. Tus derechos

Tienes derecho a acceder a tus datos, a rectificarlos, a suprimirlos, a oponerte a su tratamiento, a su portabilidad y a pedir su bloqueo. También puedes retirar en cualquier momento los permisos que hayas dado. Ejercer estos derechos es gratuito.

Desde la app puedes:

- Descargar tus datos en un archivo JSON con tu cuenta, tu perfil, tus evaluaciones con sus respuestas y resultados, y tus puntajes (acceso y portabilidad): Perfil, Mis datos, Descargar mis datos.
- Corregir tu perfil de estudio (rectificación): Perfil.
- Borrar tu cuenta (supresión): Perfil, Mis datos, Borrar mi cuenta.
- Retirar el permiso de tus puntajes PAES: Perfil, Mis datos, Puntajes PAES.

Para cualquier otra solicitud, o si prefieres hacerla por escrito, escribe a superapaes@gmail.com desde el correo de tu cuenta. Respondemos dentro de 30 días corridos.

Si consideras que no se respetaron tus derechos, puedes reclamar ante la Agencia de Protección de Datos Personales.

## 9. Cómo borrar tu cuenta

En la app: Perfil, Mis datos, Borrar mi cuenta, y confirma. Si tienes una suscripción activa o en mora, la app te avisa que la tienda seguirá cobrando hasta que la canceles en Google Play o en la App Store, te ofrece abrir la gestión de suscripciones de la tienda y te pide marcar que entiendes que debes cancelarla allí.

Si ya no tienes la app, escribe a superapaes@gmail.com desde el correo de tu cuenta pidiendo el borrado, y lo hacemos dentro de 30 días corridos.

Al borrar la cuenta pasa lo que indica el punto 7.

## 10. Seguridad

Supera PAES protege tus datos con conexiones cifradas (HTTPS), contraseñas guardadas con hash, enlaces y códigos guardados cifrados, acceso de cada usuario interno solo a lo que corresponde a su rol, registro de las acciones del equipo, respaldos cifrados y revisiones de seguridad. Si ocurre una vulneración de seguridad que afecte tus datos, Aprueba la informa a la Agencia de Protección de Datos Personales y, cuando corresponde, a los estudiantes afectados, según la ley.

## 11. Adolescentes

Supera PAES es para personas de 14 años o más, que pueden aceptar esta política por sí mismas, porque el servicio no pide datos sensibles. Los padres o tutores que tengan dudas pueden escribir a superapaes@gmail.com.

## 12. Cookies y seguimiento

La app no usa identificadores de publicidad ni herramientas de seguimiento de terceros. Las páginas públicas de la consola no usan cookies de seguimiento; la consola solo guarda la sesión de los usuarios internos que inician sesión.

## 13. Cambios a esta política

La política se numera como versión mayor.menor. Un cambio menor (por ejemplo, de 1.0 a 1.1) se te informa con un aviso en la app. Un cambio mayor (por ejemplo, de 1.0 a 2.0), como un nuevo uso de tus datos, debes aceptarlo al iniciar sesión para seguir usando la app.

## 14. Contacto

Aprueba, representada por Sebastián Pérez. Correo: superapaes@gmail.com.
$doc$, '2026-10-19 00:00:00-03'::timestamptz
FROM contenido.tipo_documento_legal t WHERE t.codigo = 'privacidad'
ON CONFLICT (tipo_documento_legal_id, version) DO NOTHING;

INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde)
SELECT t.id, '1.0', $doc$# Permiso para usar los puntajes PAES

Versión 1.0. Vigente desde 19/10/2026.

Autorizo a Supera PAES a guardar los puntajes PAES que declaro y a usarlos solo en métricas agregadas que no me identifican. Puedo retirar este permiso en Mis datos y mis puntajes se eliminarán.

Este permiso es opcional y no cambia nada de lo que puedes hacer en la app. Los puntajes se usan solo en métricas agregadas que no te identifican, como indica el punto 4 de la Política de privacidad.
$doc$, '2026-10-19 00:00:00-03'::timestamptz
FROM contenido.tipo_documento_legal t WHERE t.codigo = 'puntajes'
ON CONFLICT (tipo_documento_legal_id, version) DO NOTHING;

COMMIT;
