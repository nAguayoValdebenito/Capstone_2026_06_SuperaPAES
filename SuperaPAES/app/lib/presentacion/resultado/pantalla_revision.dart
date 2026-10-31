import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';
import 'package:supera_paes/presentacion/correccion/partes_correccion.dart';
import 'package:supera_paes/presentacion/pregunta/texto_de_lectura.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';

/// Qué preguntas se revisan (A33).
enum FiltroRevision { todas, incorrectas, omitidas }

/// Revisión pregunta por pregunta (A33; HU-61 esc. 2, CU-29, RF-A23): cada
/// pregunta tal como la vio, con la respuesta elegida, la correcta y la
/// explicación, una a la vez y con filtros por incorrectas y omitidas.
class PantallaRevision extends ConsumerStatefulWidget {
  const PantallaRevision({super.key});

  @override
  ConsumerState<PantallaRevision> createState() => _PantallaRevisionState();
}

class _PantallaRevisionState extends ConsumerState<PantallaRevision> {
  FiltroRevision _filtro = FiltroRevision.todas;
  int _indice = 0;

  static bool _cumple(PreguntaRevisada pregunta, FiltroRevision filtro) =>
      switch (filtro) {
        FiltroRevision.todas => true,
        FiltroRevision.incorrectas =>
          pregunta.resultado == ResultadoPregunta.incorrecta,
        FiltroRevision.omitidas =>
          pregunta.resultado == ResultadoPregunta.omitida,
      };

  @override
  Widget build(BuildContext context) {
    final revision = ref.watch(revisionProvider);
    final preguntas = revision.value ?? const <PreguntaRevisada>[];
    final filtradas = [
      for (final pregunta in preguntas)
        if (_cumple(pregunta, _filtro)) pregunta,
    ];
    final indice = filtradas.isEmpty
        ? 0
        : _indice.clamp(0, filtradas.length - 1);
    final actual = filtradas.isEmpty ? null : filtradas[indice];
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(texto: 'Resultado', destino: Rutas.resultado),
        ...switch (revision) {
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar la revisión.',
              alReintentar: () => ref.invalidate(revisionProvider),
            ),
          ],
          AsyncData(value: final List<PreguntaRevisada> _) => [
            _filtros(preguntas),
            if (actual == null)
              Aviso(tono: TonoAviso.neutro, texto: _sinPreguntas(_filtro))
            else
              ..._pregunta(actual, preguntas.length),
          ],
          AsyncData() => const [
            Encabezado(
              titulo: 'No hay una evaluación para revisar',
              bajada: 'Cuando termines una evaluación, aquí podrás revisarla.',
            ),
          ],
          _ => const [Center(child: CircularProgressIndicator())],
        },
      ],
      pie: filtradas.length < 2
          ? null
          : Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: indice == 0
                        ? null
                        : () => setState(() => _indice = indice - 1),
                    child: const Text('Anterior'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: indice == filtradas.length - 1
                        ? null
                        : () => setState(() => _indice = indice + 1),
                    child: const Text('Siguiente'),
                  ),
                ),
              ],
            ),
    );
  }

  /// «Todas (22)», «Incorrectas (4)» y «Omitidas (3)».
  Widget _filtros(List<PreguntaRevisada> preguntas) {
    int cuantas(FiltroRevision filtro) =>
        preguntas.where((pregunta) => _cumple(pregunta, filtro)).length;
    return SelectorSegmentado<FiltroRevision>(
      opciones: [
        for (final (filtro, texto) in const [
          (FiltroRevision.todas, 'Todas'),
          (FiltroRevision.incorrectas, 'Incorrectas'),
          (FiltroRevision.omitidas, 'Omitidas'),
        ])
          (filtro, '$texto (${cuantas(filtro)})'),
      ],
      seleccionado: _filtro,
      onChanged: (filtro) => setState(() {
        _filtro = filtro;
        _indice = 0;
      }),
    );
  }

  static String _sinPreguntas(FiltroRevision filtro) => switch (filtro) {
    FiltroRevision.incorrectas => 'No tienes respuestas incorrectas.',
    FiltroRevision.omitidas => 'No dejaste preguntas sin responder.',
    FiltroRevision.todas => 'Esta evaluación no tiene preguntas para revisar.',
  };

  static List<Widget> _pregunta(PreguntaRevisada pregunta, int total) {
    final (etiqueta, tono) = switch (pregunta.resultado) {
      ResultadoPregunta.correcta => ('Correcta', TonoEtiqueta.exito),
      ResultadoPregunta.incorrecta => ('Incorrecta', TonoEtiqueta.error),
      ResultadoPregunta.omitida => ('Omitida', TonoEtiqueta.aviso),
    };
    return [
      Wrap(
        spacing: 8,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Semantics(
            header: true,
            child: Text(
              'Pregunta ${pregunta.orden} de $total · ${pregunta.eje}',
              style: TemaSuperaPaes.etiqueta,
            ),
          ),
          Etiqueta(texto: etiqueta, tono: tono),
        ],
      ),
      if (pregunta.anulada)
        const Aviso(
          tono: TonoAviso.neutro,
          texto:
              'Esta pregunta se anuló por un error y no cuenta en tu '
              'resultado.',
        )
      else if (!pregunta.puntuable)
        const Aviso(
          tono: TonoAviso.neutro,
          texto:
              'Esta pregunta no puntúa: como en la PAES, no cuenta en tu '
              'resultado.',
        ),
      if (pregunta.texto case final texto?) TarjetaTextoDeLectura(texto: texto),
      TextoConFormulas(pregunta.enunciado, estilo: TemaSuperaPaes.cuerpoFuerte),
      for (final alternativa in pregunta.alternativas)
        AlternativaCorregidaVista(
          id: alternativa.id,
          letra: alternativa.letra,
          texto: alternativa.texto,
          correctaId: pregunta.alternativaCorrectaId,
          elegidaId: pregunta.alternativaElegidaId,
        ),
      ExplicacionCorreccion(
        acerto: pregunta.resultado == ResultadoPregunta.correcta,
        explicacion: pregunta.explicacion,
        elegida: pregunta.elegida,
      ),
      Text(
        'Se muestra tal como la viste, aunque después se haya editado.',
        style: TemaSuperaPaes.pequeno.copyWith(
          color: TemaSuperaPaes.textoSecundario,
        ),
      ),
    ];
  }
}
