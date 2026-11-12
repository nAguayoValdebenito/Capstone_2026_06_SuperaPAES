import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/fechas.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/texto_documento.dart';

/// Términos y privacidad (A02 y A02b, RN-30): una pestaña por documento, con
/// su título, la versión vigente y su fecha, y cada sección numerada en una
/// fila que se abre y se cierra; la primera parte abierta. Con sesión se
/// vuelve a Perfil; sin ella (desde Crear cuenta), a donde se abrió.
class VistaDocumentoLegal extends ConsumerWidget {
  const VistaDocumentoLegal({required this.tipo, super.key});

  final TipoDocumentoLegal tipo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final documentos = ref.watch(documentosVigentesProvider);
    final conSesion = ref.watch(sesionProvider).value != null;
    final documento = documentos.value
        ?.where((d) => d.tipo == tipo)
        .firstOrNull;
    return PantallaFormulario(
      anchoMaximo: TemaSuperaPaes.anchoLectura,
      hijos: [
        EnlaceVolver(
          texto: conSesion ? 'Perfil' : 'Volver',
          destino: conSesion ? Rutas.perfil : Rutas.ingreso,
        ),
        Encabezado(
          titulo: documento?.nombre ?? _tituloPorTipo(tipo),
          bajada: documento == null
              ? null
              : 'Versión ${documento.version}. Vigente desde el '
                    '${_fecha(documento.vigenteDesde)}.',
        ),
        _Pestanas(activa: tipo),
        ...switch (documentos) {
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar el documento.',
              alReintentar: () => ref.invalidate(documentosVigentesProvider),
            ),
          ],
          AsyncData() when documento == null => [
            const Aviso(
              tono: TonoAviso.aviso,
              texto: 'Este documento no está disponible por ahora.',
            ),
          ],
          AsyncData() => [
            _Secciones(
              key: ValueKey(tipo),
              secciones: seccionesDelDocumento(documento!.texto),
            ),
            Text(
              '¿Dudas? Escríbenos a superapaes@gmail.com.',
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
          ],
          _ => const [GrupoEsqueleto(child: EsqueletoTarjeta(lineas: 6))],
        },
      ],
    );
  }

  static String _tituloPorTipo(TipoDocumentoLegal tipo) => switch (tipo) {
    TipoDocumentoLegal.terminos => 'Términos y condiciones',
    TipoDocumentoLegal.privacidad => 'Política de privacidad',
  };

  /// La vigencia empieza a la medianoche de Chile, que en UTC sigue siendo
  /// el mismo día.
  static String _fecha(DateTime fecha) {
    final dia = fecha.toUtc();
    return fechaConAnio(DateTime(dia.year, dia.month, dia.day));
  }
}

/// Una sección del documento: «1» y «Quiénes somos», con su texto.
typedef SeccionDocumento = ({String numero, String titulo, String cuerpo});

/// Divide el documento en sus secciones «## N. Título». Lo que va antes de
/// la primera (fuera del título y de la línea de versión) queda como una
/// sección sin número, para no perder texto.
List<SeccionDocumento> seccionesDelDocumento(String markdown) {
  final secciones = <SeccionDocumento>[];
  final numerada = RegExp(r'^(\d+)\.\s+(.*)$');
  String? numero;
  String? titulo;
  final cuerpo = <String>[];

  void cerrar() {
    final texto = cuerpo.join('\n').trim();
    if (titulo != null || texto.isNotEmpty) {
      secciones.add((
        numero: numero ?? '',
        titulo: titulo ?? 'Introducción',
        cuerpo: texto,
      ));
    }
    cuerpo.clear();
  }

  for (final linea in markdown.split('\n')) {
    final limpia = linea.trim();
    if (limpia.startsWith('# ') || limpia.startsWith('Versión ')) continue;
    if (limpia.startsWith('## ')) {
      cerrar();
      final encabezado = limpia.substring(3).trim();
      final partes = numerada.firstMatch(encabezado);
      numero = partes?.group(1);
      titulo = partes?.group(2) ?? encabezado;
    } else {
      cuerpo.add(linea);
    }
  }
  cerrar();
  return secciones;
}

/// Las secciones en una lista con borde; cada una se abre y se cierra. La
/// primera parte abierta (A02).
class _Secciones extends StatelessWidget {
  const _Secciones({required this.secciones, super.key});

  final List<SeccionDocumento> secciones;

  @override
  Widget build(BuildContext context) {
    final radio = BorderRadius.circular(TemaSuperaPaes.radioTarjeta);
    return Material(
      color: TemaSuperaPaes.superficie,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: radio,
        side: const BorderSide(color: TemaSuperaPaes.borde),
      ),
      child: Column(
        children: [
          for (final (i, seccion) in secciones.indexed) ...[
            if (i > 0) const Divider(height: 1),
            _Seccion(seccion: seccion, abierta: i == 0),
          ],
        ],
      ),
    );
  }
}

class _Seccion extends StatefulWidget {
  const _Seccion({required this.seccion, required this.abierta});

  final SeccionDocumento seccion;
  final bool abierta;

  @override
  State<_Seccion> createState() => _SeccionState();
}

class _SeccionState extends State<_Seccion> {
  late bool _abierta = widget.abierta;

  @override
  Widget build(BuildContext context) {
    final seccion = widget.seccion;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          expanded: _abierta,
          child: InkWell(
            onTap: () => setState(() => _abierta = !_abierta),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: TemaSuperaPaes.espacio16,
                vertical: TemaSuperaPaes.espacio12,
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 28,
                    child: Text(
                      seccion.numero,
                      style: TemaSuperaPaes.pequeno.copyWith(
                        color: TemaSuperaPaes.primario,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      seccion.titulo,
                      style: TemaSuperaPaes.cuerpoFuerte,
                    ),
                  ),
                  const SizedBox(width: TemaSuperaPaes.espacio8),
                  ExcludeSemantics(
                    child: AnimatedRotation(
                      turns: _abierta ? 0.5 : 0,
                      duration: duracion(
                        context,
                        TemaSuperaPaes.movimientoNormal,
                      ),
                      child: Icon(
                        Icons.expand_more_rounded,
                        color: _abierta
                            ? TemaSuperaPaes.primario
                            : TemaSuperaPaes.textoSecundario,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        AnimatedSize(
          duration: duracion(context, TemaSuperaPaes.movimientoNormal),
          curve: TemaSuperaPaes.curvaEntrada,
          alignment: Alignment.topCenter,
          child: _abierta
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(
                    TemaSuperaPaes.espacio16,
                    0,
                    TemaSuperaPaes.espacio16,
                    TemaSuperaPaes.espacio4,
                  ),
                  child: TextoDocumento(seccion.cuerpo),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// Pestañas Términos | Privacidad. Cambiar de pestaña reemplaza la pantalla,
/// así «Volver» sigue llevando a donde se abrió.
class _Pestanas extends StatelessWidget {
  const _Pestanas({required this.activa});

  final TipoDocumentoLegal activa;

  @override
  Widget build(BuildContext context) {
    Widget pestana(String texto, TipoDocumentoLegal tipo, String ruta) {
      final seleccionada = tipo == activa;
      return Expanded(
        child: Semantics(
          selected: seleccionada,
          button: true,
          child: Material(
            color: seleccionada
                ? TemaSuperaPaes.superficie
                : Colors.transparent,
            borderRadius: BorderRadius.circular(TemaSuperaPaes.radioSegmento),
            child: InkWell(
              borderRadius: BorderRadius.circular(TemaSuperaPaes.radioSegmento),
              onTap: seleccionada ? null : () => context.replace(ruta),
              child: SizedBox(
                height: TemaSuperaPaes.altoSegmento,
                child: Center(
                  child: Text(
                    texto,
                    textAlign: TextAlign.center,
                    style: TemaSuperaPaes.etiqueta.copyWith(
                      color: seleccionada
                          ? TemaSuperaPaes.primario
                          : TemaSuperaPaes.textoSecundario,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(TemaSuperaPaes.espacio4),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.neutroSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
      ),
      child: Row(
        children: [
          pestana('Términos', TipoDocumentoLegal.terminos, Rutas.terminos),
          pestana(
            'Privacidad',
            TipoDocumentoLegal.privacidad,
            Rutas.privacidad,
          ),
        ],
      ),
    );
  }
}
