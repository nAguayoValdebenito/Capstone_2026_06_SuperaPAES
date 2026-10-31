import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';

/// Mis datos y privacidad (A39; HU-07, HU-08, HU-41 esc. 4, CU-14), desde
/// Perfil: descargar los datos en un archivo, los puntajes PAES con su
/// permiso, borrar la cuenta y las versiones aceptadas de los términos y de
/// la privacidad (CU-14 paso 2). «Solicitudes sobre mis datos» (HU-09) se
/// agrega con su historia.
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
    final aceptados = ref.watch(estadoDeLaCuentaProvider).value;
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
        // Mientras carga, o si falla, no se muestra: no impide nada.
        if (aceptados != null && aceptados.documentosAceptados.isNotEmpty)
          Text(
            terminosAceptados(aceptados.documentosAceptados),
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
      ],
    );
  }
}

/// «Aceptaste los Términos y condiciones 1.0 y la Política de privacidad 1.0
/// el 21/10/2026.», como en A39. Si los aceptó en días distintos, cada uno
/// lleva su fecha.
String terminosAceptados(List<DocumentoAceptado> documentos) {
  String nombre(DocumentoAceptado documento) => switch (documento.tipo) {
    TipoDocumentoLegal.terminos => 'los Términos y condiciones',
    TipoDocumentoLegal.privacidad => 'la Política de privacidad',
  };
  String fecha(DateTime dia) {
    String dos(int n) => n.toString().padLeft(2, '0');
    return '${dos(dia.day)}/${dos(dia.month)}/${dia.year}';
  }

  final fechas = {for (final d in documentos) fecha(d.aceptadoEn)};
  final mismaFecha = fechas.length == 1;
  final partes = [
    for (final d in documentos)
      if (mismaFecha)
        '${nombre(d)} ${d.version}'
      else
        '${nombre(d)} ${d.version} el ${fecha(d.aceptadoEn)}',
  ];
  final unidas = partes.join(' y ');
  return mismaFecha
      ? 'Aceptaste $unidas el ${fechas.single}.'
      : 'Aceptaste $unidas.';
}
