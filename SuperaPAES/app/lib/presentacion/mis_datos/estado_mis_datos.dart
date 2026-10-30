import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import 'package:supera_paes/datos/fuentes/fuente_mis_datos_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_mis_datos_api.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_mis_datos.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:url_launcher/url_launcher.dart';

/// Mis datos (HU-07 y HU-08): sus rutas exigen sesión, así que va con el
/// cliente que agrega el token y lo renueva.
final repositorioMisDatosProvider = Provider<RepositorioMisDatos>(
  (ref) => RepositorioMisDatosApi(
    FuenteMisDatosRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// Entrega el archivo al estudiante. Termina cuando se cierra el menú.
typedef CompartirArchivo = Future<void> Function(ArchivoMisDatos archivo);

/// Abre el menú Compartir del sistema con el archivo, para guardarlo en
/// Archivos o en Drive, o enviarlo (HU-07.2). Las pruebas lo reemplazan.
final compartirArchivoProvider = Provider<CompartirArchivo>(
  (ref) => (archivo) async {
    await SharePlus.instance.share(
      ShareParams(
        title: 'Mis datos de Supera PAES',
        files: [
          XFile.fromData(
            utf8.encode(archivo.contenido),
            mimeType: 'application/json',
          ),
        ],
        fileNameOverrides: [archivo.nombre],
      ),
    );
  },
);

/// «Descargar mis datos» en A39 y en el aviso de A42 (CU-14 3.a y paso 4):
/// pide los datos y abre el menú Compartir con el archivo. Mientras tanto,
/// [descargando]; si falla, el mensaje queda en [error].
mixin DescargaDeMisDatos<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  bool descargando = false;
  String? error;

  Future<void> descargar() async {
    if (descargando) return;
    setState(() {
      descargando = true;
      error = null;
    });
    String? fallo;
    try {
      final archivo = await ref.read(repositorioMisDatosProvider).descargar();
      await ref.read(compartirArchivoProvider)(archivo);
    } on ErrorApi catch (errorApi) {
      fallo = errorApi.mensaje;
    } on Exception {
      fallo = 'No se pudo abrir el menú para guardar el archivo.';
    }
    if (mounted) {
      setState(() {
        descargando = false;
        error = fallo;
      });
    }
  }
}

/// La suscripción que la tienda sigue cobrando (A42b). Se vuelve a pedir cada
/// vez que se abre «Borrar mi cuenta»: pudo comprarse o cancelarse entre medio.
final FutureProvider<SuscripcionVigente?> suscripcionVigenteProvider =
    FutureProvider.autoDispose<SuscripcionVigente?>(
      (ref) => ref.watch(repositorioMisDatosProvider).suscripcionVigente(),
    );

/// Abre un enlace fuera de la app; `false` si no pudo. Las pruebas lo
/// reemplazan.
typedef AbrirEnlace = Future<bool> Function(Uri enlace);

/// Abre el enlace en la app de la tienda o en el navegador.
final abrirEnlaceProvider = Provider<AbrirEnlace>(
  (ref) =>
      (enlace) => launchUrl(enlace, mode: LaunchMode.externalApplication),
);

/// La gestión de suscripciones de cada tienda, donde se cancela (RN-34).
Uri gestionDeSuscripciones(Tienda tienda) => Uri.parse(switch (tienda) {
  Tienda.googlePlay => 'https://play.google.com/store/account/subscriptions',
  Tienda.appStore => 'https://apps.apple.com/account/subscriptions',
});
