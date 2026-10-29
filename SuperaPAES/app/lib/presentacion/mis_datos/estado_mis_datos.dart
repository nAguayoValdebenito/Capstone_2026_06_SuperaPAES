import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import 'package:supera_paes/datos/fuentes/fuente_mis_datos_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_mis_datos_api.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_mis_datos.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Mis datos (HU-07): su ruta exige sesión, así que va con el cliente que
/// agrega el token y lo renueva.
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
