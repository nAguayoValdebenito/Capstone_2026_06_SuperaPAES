import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/texto_documento.dart';

/// Términos y privacidad (A02 y A02b, RN-30), según su boceto en Figma: una
/// pestaña por documento, con la versión vigente y su fecha sobre el texto.
class VistaDocumentoLegal extends ConsumerWidget {
  const VistaDocumentoLegal({required this.tipo, super.key});

  final TipoDocumentoLegal tipo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final documentos = ref.watch(documentosVigentesProvider);
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.ingreso),
        const Encabezado(titulo: 'Términos y privacidad'),
        _Pestanas(activa: tipo),
        documentos.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Aviso(
                tono: TonoAviso.error,
                texto: error is ErrorApi
                    ? error.mensaje
                    : 'No se pudo cargar el documento.',
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => ref.invalidate(documentosVigentesProvider),
                child: const Text('Reintentar'),
              ),
            ],
          ),
          data: (lista) {
            final documento = lista.where((d) => d.tipo == tipo).firstOrNull;
            if (documento == null) {
              return const Aviso(
                tono: TonoAviso.aviso,
                texto: 'Este documento no está disponible por ahora.',
              );
            }
            return _Documento(documento: documento);
          },
        ),
        OutlinedButton(
          onPressed: () =>
              context.canPop() ? context.pop() : context.go(Rutas.ingreso),
          child: const Text('Volver'),
        ),
      ],
    );
  }
}

/// «Versión 1.0 · vigente desde 19/10/2026» y el texto en una tarjeta. El
/// título y la línea de versión del Markdown no se repiten.
class _Documento extends StatelessWidget {
  const _Documento({required this.documento});

  final DocumentoLegal documento;

  static String _fecha(DateTime fecha) {
    // La vigencia empieza a la medianoche de Chile, que en UTC sigue siendo
    // el mismo día.
    final dia = fecha.toUtc();
    String dos(int n) => n.toString().padLeft(2, '0');
    return '${dos(dia.day)}/${dos(dia.month)}/${dia.year}';
  }

  @override
  Widget build(BuildContext context) {
    final markdown = documento.texto
        .split('\n')
        .where((l) => !l.startsWith('# ') && !l.startsWith('Versión '))
        .join('\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Versión ${documento.version} · vigente desde '
          '${_fecha(documento.vigenteDesde)}',
          style: TemaSuperaPaes.pequenoFuerte.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        const SizedBox(height: 12),
        Tarjeta(child: TextoDocumento(markdown)),
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
            borderRadius: BorderRadius.circular(10),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: seleccionada ? null : () => context.replace(ruta),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
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
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
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
