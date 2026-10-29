import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';

/// Mis datos y privacidad (A39; HU-07, HU-41 esc. 4, CU-14), desde Perfil:
/// descargar los datos en un archivo y los puntajes PAES con su permiso.
/// «Solicitudes sobre mis datos» (HU-09), «Borrar mi cuenta» (HU-08) y los
/// términos aceptados se agregan con sus historias.
class PantallaMisDatos extends ConsumerStatefulWidget {
  const PantallaMisDatos({super.key});

  @override
  ConsumerState<PantallaMisDatos> createState() => _PantallaMisDatosState();
}

class _PantallaMisDatosState extends ConsumerState<PantallaMisDatos> {
  bool _descargando = false;
  String? _error;

  static String _cargados(int cantidad) =>
      cantidad == 1 ? '1 puntaje cargado' : '$cantidad puntajes cargados';

  /// Pide los datos y abre el menú Compartir con el archivo (CU-14 3.a).
  Future<void> _descargar() async {
    if (_descargando) return;
    setState(() {
      _descargando = true;
      _error = null;
    });
    String? error;
    try {
      final archivo = await ref.read(repositorioMisDatosProvider).descargar();
      await ref.read(compartirArchivoProvider)(archivo);
    } on ErrorApi catch (fallo) {
      error = fallo.mensaje;
    } on Exception {
      error = 'No se pudo abrir el menú para guardar el archivo.';
    }
    if (mounted) {
      setState(() {
        _descargando = false;
        _error = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final puntajes = ref.watch(puntajesProvider).value;
    // «Permiso activo · 0 puntajes cargados», como en A39.
    final resumen = switch (puntajes) {
      null => 'Opcionales, con tu permiso.',
      final datos when !datos.permiso.otorgado => 'Sin permiso · opcional',
      final datos => 'Permiso activo · ${_cargados(datos.puntajes.length)}',
    };
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(texto: 'Perfil', destino: Rutas.perfil),
        const Encabezado(titulo: 'Mis datos y privacidad'),
        ListaDeFilas(
          filas: [
            FilaNavegacion(
              texto: 'Descargar mis datos',
              detalle: _descargando
                  ? 'Preparando tu archivo…'
                  : 'Tu cuenta, perfil, historial, respuestas, resultados y '
                        'puntajes en un archivo.',
              onTap: _descargar,
            ),
            FilaNavegacion(
              texto: 'Puntajes PAES',
              detalle: resumen,
              onTap: () => context.push(Rutas.puntajes),
            ),
          ],
        ),
        if (_error case final mensaje?)
          Aviso(tono: TonoAviso.error, texto: mensaje),
      ],
    );
  }
}
