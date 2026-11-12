import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/fechas.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';

/// Mis datos y privacidad (A39; HU-07, HU-08, HU-41 esc. 4, CU-14), desde
/// Perfil: las versiones aceptadas de los términos y de la privacidad (CU-14
/// paso 2), descargar los datos en un archivo, los puntajes PAES con su
/// permiso y borrar la cuenta. «Solicitudes sobre mis datos» (HU-09, A40)
/// se agrega cuando la API de la app tenga sus rutas.
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
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final resumen = switch (puntajes) {
      null => 'Opcionales, con tu permiso',
      final datos when !datos.permiso.otorgado => 'Permiso desactivado',
      final datos => 'Permiso activo · ${_cargados(datos.puntajes.length)}',
    };
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(texto: 'Perfil', destino: Rutas.perfil),
        const Encabezado(titulo: 'Mis datos y privacidad'),
        // Mientras carga, o si falla, no se muestra: no impide nada.
        if (aceptados != null && aceptados.documentosAceptados.isNotEmpty)
          Aviso(
            tono: TonoAviso.neutro,
            icono: Icons.verified_user_rounded,
            texto: terminosAceptados(aceptados.documentosAceptados),
          ),
        Tarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Descargar mis datos', style: TemaSuperaPaes.h2),
              const SizedBox(height: TemaSuperaPaes.espacio4),
              Text(
                'Descargarás un archivo JSON con tu cuenta, tu perfil, tus '
                'evaluaciones con sus respuestas y resultados, y tus puntajes.',
                style: secundario,
              ),
              const SizedBox(height: TemaSuperaPaes.espacio12),
              BotonPrincipal(
                texto: 'Descargar mis datos',
                icono: Icons.download_rounded,
                estado: descargando
                    ? EstadoBoton.cargando
                    : error == null
                    ? EstadoBoton.normal
                    : EstadoBoton.error,
                error: error,
                onPressed: descargar,
              ),
            ],
          ),
        ),
        ListaDeFilas(
          filas: [
            FilaNavegacion(
              texto: 'Mis puntajes PAES',
              detalle: resumen,
              icono: Icons.emoji_events_rounded,
              onTap: () => context.push(Rutas.puntajes),
            ),
          ],
        ),
        const TituloSeccion('Si ya no quieres usar Supera PAES'),
        ListaDeFilas(
          filas: [
            FilaNavegacion(
              texto: 'Borrar mi cuenta',
              detalle: 'No se puede deshacer',
              icono: Icons.delete_outline_rounded,
              onTap: () => context.push(Rutas.borrarCuenta),
            ),
          ],
        ),
      ],
    );
  }
}

/// «Aceptaste los Términos y condiciones 1.0 y la Política de privacidad 1.0
/// el 6 de noviembre de 2026.», como en A39. Si los aceptó en días
/// distintos, cada uno lleva su fecha.
String terminosAceptados(List<DocumentoAceptado> documentos) {
  String nombre(DocumentoAceptado documento) => switch (documento.tipo) {
    TipoDocumentoLegal.terminos => 'los Términos y condiciones',
    TipoDocumentoLegal.privacidad => 'la Política de privacidad',
  };
  final fechas = {for (final d in documentos) fechaConAnio(d.aceptadoEn)};
  final mismaFecha = fechas.length == 1;
  final partes = [
    for (final d in documentos)
      if (mismaFecha)
        '${nombre(d)} ${d.version}'
      else
        '${nombre(d)} ${d.version} el ${fechaConAnio(d.aceptadoEn)}',
  ];
  final unidas = partes.join(' y ');
  return mismaFecha
      ? 'Aceptaste $unidas el ${fechas.single}.'
      : 'Aceptaste $unidas.';
}
