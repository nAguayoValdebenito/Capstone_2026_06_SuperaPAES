import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import 'package:supera_paes/dominio/entidades/resumen_invitaciones.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';

/// El código, el link y los contadores de A38. Se vuelven a pedir cada vez
/// que se abre: un invitado pudo registrarse o verificar su correo.
final FutureProvider<ResumenInvitaciones> invitacionesProvider =
    FutureProvider.autoDispose<ResumenInvitaciones>(
      (ref) => ref.watch(repositorioCupoProvider).misInvitaciones(),
    );

/// Entrega un texto al menú Compartir del sistema. Termina cuando se cierra.
typedef CompartirTexto = Future<void> Function(String texto);

/// Abre el menú Compartir con la invitación (HU-46.2, CU-11 paso 3), para
/// enviarla con la aplicación que prefiera. Las pruebas lo reemplazan.
final compartirTextoProvider = Provider<CompartirTexto>(
  (ref) => (texto) async {
    await SharePlus.instance.share(
      ShareParams(text: texto, subject: 'Te invito a Supera PAES'),
    );
  },
);

/// El mensaje que se comparte: el código, por si el link no abre, y el link.
String mensajeDeInvitacion(ResumenInvitaciones invitaciones) =>
    'Te invito a practicar la PAES en Supera PAES, con preguntas revisadas '
    'por docentes. Descarga la app y escribe mi código '
    '${invitaciones.codigo} al crear tu cuenta: ${invitaciones.link}';
