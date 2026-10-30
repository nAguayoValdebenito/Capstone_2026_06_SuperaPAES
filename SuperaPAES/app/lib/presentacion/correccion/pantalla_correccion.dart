import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';
import 'package:supera_paes/presentacion/correccion/partes_correccion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/pregunta/partes_pregunta.dart';
import 'package:supera_paes/presentacion/pregunta/texto_de_lectura.dart';

/// Corrección con explicación (A19, y A19b si falló; HU-32 esc. 1 a 4,
/// CU-07 pasos 4 a 6, RF-A08, RN-06): la corrigió el servidor. Muestra si
/// acertó, la alternativa correcta, la suya y la explicación; las
/// alternativas ya no se pueden cambiar. Sigue con la siguiente pregunta o,
/// después de la última, con el resumen (A21).
class PantallaCorreccion extends ConsumerWidget {
  const PantallaCorreccion({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ultima = ref.watch(practicaProvider).correccion;
    if (ultima == null) {
      return PantallaFormulario(
        hijos: [
          const SizedBox(height: 32),
          const Encabezado(
            titulo: 'No hay una respuesta para revisar',
            bajada:
                'Responde una pregunta de tu práctica para ver su '
                'corrección.',
          ),
          FilledButton(
            onPressed: () => context.go(Rutas.practicar),
            child: const Text('Ir a Practicar'),
          ),
        ],
      );
    }
    final (:pregunta, :correccion) = ultima;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const CabeceraPractica(),
        AvancePractica(pregunta: pregunta, respondida: true),
        Aviso(
          tono: correccion.esCorrecta ? TonoAviso.exito : TonoAviso.error,
          texto: correccion.esCorrecta
              ? 'Respuesta correcta'
              : 'Respuesta incorrecta',
        ),
        if (pregunta.texto case final texto?)
          TarjetaTextoDeLectura(texto: texto),
        TextoConFormulas(
          pregunta.enunciado,
          estilo: TemaSuperaPaes.cuerpoFuerte,
        ),
        for (final alternativa in pregunta.alternativas)
          AlternativaCorregidaVista(
            id: alternativa.id,
            letra: alternativa.letra,
            texto: alternativa.texto,
            correctaId: correccion.alternativaCorrectaId,
            elegidaId: correccion.alternativaElegidaId,
          ),
        ExplicacionCorreccion(
          acerto: correccion.esCorrecta,
          explicacion: correccion.explicacion,
          elegida: correccion.elegida,
        ),
      ],
      pie: FilledButton(
        onPressed: pregunta.esLaUltima
            ? () => terminarPractica(context, ref, preguntar: false)
            : () {
                ref.read(practicaProvider.notifier).seguir();
                ref.invalidate(preguntaActualProvider);
                context.go(Rutas.pregunta);
              },
        child: Text(pregunta.esLaUltima ? 'Ver resumen' : 'Siguiente pregunta'),
      ),
    );
  }
}
