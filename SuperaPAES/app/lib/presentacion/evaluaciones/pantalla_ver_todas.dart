import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/navegar.dart';
import 'package:supera_paes/presentacion/evaluaciones/cabecera_con_reloj.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';

/// Ver todas y entregar (A28; HU-40 esc. 2, CU-10 paso 7, RN-22): el mapa
/// de respondidas y sin responder, cada una lleva a su pregunta. Confirma la
/// entrega avisando que las omitidas cuentan como incorrectas.
class PantallaVerTodas extends ConsumerStatefulWidget {
  const PantallaVerTodas({super.key});

  @override
  ConsumerState<PantallaVerTodas> createState() => _PantallaVerTodasState();
}

class _PantallaVerTodasState extends ConsumerState<PantallaVerTodas> {
  bool _entregando = false;

  Future<void> _entregar() async {
    setState(() => _entregando = true);
    await entregarEvaluacion(context, ref);
    if (mounted) setState(() => _entregando = false);
  }

  /// A27 en esa pregunta: volviendo atrás si A28 se abrió desde ella.
  void _verPregunta(int indice) {
    ref.read(evaluacionConTiempoProvider.notifier).irA(indice);
    _seguir();
  }

  void _seguir() => context.canPop()
      ? context.pop()
      : abrirConcentracion(context, Rutas.preguntaConReloj);

  @override
  Widget build(BuildContext context) {
    final enCurso = ref.watch(evaluacionConTiempoProvider);
    if (enCurso == null) return const SinEvaluacionEnCurso();
    final faltan = enCurso.sinResponder;
    return PantallaFormulario(
      separacion: 16,
      hijos: [
        const CabeceraConReloj(),
        const Encabezado(titulo: 'Tus respuestas'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final (i, pregunta) in enCurso.preguntas.indexed)
              _Casilla(
                numero: i + 1,
                pregunta: pregunta,
                onTap: () => _verPregunta(i),
              ),
          ],
        ),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: [
            _Leyenda(
              respondida: true,
              texto: 'Respondidas ${enCurso.respondidas}',
            ),
            _Leyenda(respondida: false, texto: 'Sin responder $faltan'),
          ],
        ),
        if (faltan > 0)
          Aviso(
            tono: TonoAviso.aviso,
            texto: faltan == 1
                ? 'Si entregas ahora, la que está sin responder cuenta como '
                      'incorrecta y pasa a tu repaso.'
                : 'Si entregas ahora, las $faltan sin responder cuentan como '
                      'incorrectas y pasan a tu repaso.',
          )
        else
          const Aviso(
            tono: TonoAviso.info,
            texto: 'Respondiste todas. Al entregar verás tu resultado.',
          ),
      ],
      pie: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton(
            onPressed: _entregando ? null : _entregar,
            child: _entregando
                ? const CargandoEnBoton()
                : const Text('Entregar ahora'),
          ),
          const SizedBox(height: 4),
          BotonTexto(
            onPressed: _entregando ? null : _seguir,
            child: const Text('Seguir respondiendo'),
          ),
        ],
      ),
    );
  }
}

/// El número de una pregunta: en azul si está respondida.
class _Casilla extends StatelessWidget {
  const _Casilla({
    required this.numero,
    required this.pregunta,
    required this.onTap,
  });

  final int numero;
  final PreguntaConTiempo pregunta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final respondida = pregunta.respondida;
    final radio = BorderRadius.circular(TemaSuperaPaes.radioBotonChico);
    return Semantics(
      button: true,
      label: 'Pregunta $numero, ${respondida ? 'respondida' : 'sin responder'}',
      excludeSemantics: true,
      child: Material(
        color: respondida ? TemaSuperaPaes.primario : TemaSuperaPaes.superficie,
        shape: RoundedRectangleBorder(
          borderRadius: radio,
          side: BorderSide(
            color: respondida ? TemaSuperaPaes.primario : TemaSuperaPaes.borde,
          ),
        ),
        child: InkWell(
          borderRadius: radio,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minWidth: TemaSuperaPaes.botonRedondo,
              minHeight: TemaSuperaPaes.botonRedondo,
            ),
            child: Center(
              widthFactor: 1,
              heightFactor: 1,
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Text(
                  '$numero',
                  style: TemaSuperaPaes.etiqueta.copyWith(
                    color: respondida
                        ? TemaSuperaPaes.superficie
                        : TemaSuperaPaes.texto,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// «■ Respondidas 18» y «□ Sin responder 4».
class _Leyenda extends StatelessWidget {
  const _Leyenda({required this.respondida, required this.texto});

  final bool respondida;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          respondida ? Icons.square_rounded : Icons.crop_square_rounded,
          size: 16,
          color: respondida
              ? TemaSuperaPaes.primario
              : TemaSuperaPaes.textoSecundario,
        ),
        const SizedBox(width: 6),
        // Flexible: con letra grande, el texto baja de línea (RNF-12).
        Flexible(child: Text(texto, style: TemaSuperaPaes.pequeno)),
      ],
    );
  }
}
