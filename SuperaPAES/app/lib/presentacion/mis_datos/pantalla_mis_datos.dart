import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';

/// Mis datos y privacidad (A39; HU-07, HU-08, HU-41 esc. 4, CU-14), desde
/// Perfil: descargar los datos en un archivo, los puntajes PAES con su
/// permiso y borrar la cuenta. «Solicitudes sobre mis datos» (HU-09) y los
/// términos aceptados se agregan con sus historias.
class PantallaMisDatos extends ConsumerStatefulWidget {
  const PantallaMisDatos({super.key});

  @override
  ConsumerState<PantallaMisDatos> createState() => _PantallaMisDatosState();
}

class _PantallaMisDatosState extends ConsumerState<PantallaMisDatos>
    with DescargaDeMisDatos {
  static String _cargados(int cantidad) =>
      cantidad == 1 ? '1 puntaje cargado' : '$cantidad puntajes cargados';

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
              detalle: descargando
                  ? 'Preparando tu archivo…'
                  : 'Tu cuenta, perfil, historial, respuestas, resultados y '
                        'puntajes en un archivo.',
              onTap: descargar,
            ),
            FilaNavegacion(
              texto: 'Puntajes PAES',
              detalle: resumen,
              onTap: () => context.push(Rutas.puntajes),
            ),
          ],
        ),
        if (error case final mensaje?)
          Aviso(tono: TonoAviso.error, texto: mensaje),
        ListaDeFilas(
          filas: [
            FilaNavegacion(
              texto: 'Borrar mi cuenta',
              detalle: 'Esta acción no se puede deshacer.',
              icono: Icons.delete_outline,
              peligro: true,
              onTap: () => context.push(Rutas.borrarCuenta),
            ),
          ],
        ),
      ],
    );
  }
}
