import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/evaluaciones/condiciones_evaluacion.dart';
import 'package:supera_paes/presentacion/evaluaciones/empezar_con_tiempo.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/empezar_practica.dart';

/// Ofrecer el diagnóstico (A16; HU-36, CU-06 alternativo 2.a, CU-10a,
/// RF-A11, RN-20): si no lo ha rendido este año escolar, antes de practicar
/// esa prueba o desde Evaluaciones (A25). Con tiempo y sin cupo; «Ahora no»
/// sigue con la práctica y no lo vuelve a ofrecer hasta abrir de nuevo la app.
class PantallaOfrecerDiagnostico extends ConsumerStatefulWidget {
  const PantallaOfrecerDiagnostico({super.key});

  @override
  ConsumerState<PantallaOfrecerDiagnostico> createState() =>
      _PantallaOfrecerDiagnosticoState();
}

class _PantallaOfrecerDiagnosticoState
    extends ConsumerState<PantallaOfrecerDiagnostico>
    with EmpezarPractica, EmpezarConTiempo {
  static const String _condiciones =
      'Tiene tiempo, como la PAES: el reloj sigue corriendo aunque cierres la '
      'app y las que dejes sin responder cuentan como incorrectas.';

  /// «Ahora no»: practica lo que eligió, o vuelve a Evaluaciones.
  Future<void> _ahoraNo(OfertaDiagnostico oferta) async {
    ref
        .read(diagnosticosPospuestosProvider.notifier)
        .posponer(oferta.diagnostico.pruebaId);
    final practica = oferta.practica;
    if (practica == null) {
      context.pop();
    } else {
      await empezar(practica);
    }
  }

  @override
  Widget build(BuildContext context) {
    final oferta = ref.watch(ofertaDiagnosticoProvider);
    if (oferta == null) {
      return const PantallaFormulario(
        hijos: [
          EnlaceVolver(texto: 'Evaluaciones', destino: Rutas.evaluaciones),
          Encabezado(
            titulo: 'Elige una prueba',
            bajada: 'Vuelve a Evaluaciones y elige qué diagnóstico rendir.',
          ),
        ],
      );
    }
    final diagnostico = oferta.diagnostico;
    final desdePractica = oferta.practica != null;
    final prueba = ref
        .watch(opcionesPerfilProvider)
        .value
        ?.prueba(diagnostico.pruebaId);
    final nombre = prueba?.nombreCorto ?? '';
    final ocupado = empezando || empezandoConTiempo;
    final cierre = avisoDeCierre(ref);
    return PantallaFormulario(
      separacion: 16,
      hijos: [
        if (desdePractica)
          const EnlaceVolver(
            texto: 'Personaliza tu práctica',
            destino: Rutas.practicar,
          )
        else
          // Se llega desde Evaluaciones o desde Inicio, y vuelve allí.
          const EnlaceVolver(texto: 'Volver', destino: Rutas.evaluaciones),
        Encabezado(
          titulo: desdePractica
              ? 'Antes de practicar $nombre'
              : 'Diagnóstico de $nombre',
          bajada:
              'Rinde tu diagnóstico: así sabremos qué '
              '${diagnostico.ejes > 0 ? 'ejes' : 'habilidades'} reforzar y la '
              'práctica les dará prioridad.',
        ),
        Row(
          children: [
            DatoResumen(valor: '${diagnostico.cantidad}', texto: 'preguntas'),
            DatoResumen(valor: '${diagnostico.duracionMin}', texto: 'minutos'),
            const DatoResumen(valor: '0', texto: 'de tu cupo'),
          ],
        ),
        Text(
          diagnostico.ejes > 0
              ? 'Solo de ejes que ya viste. Se rinde una vez por año escolar.'
              : 'Se rinde una vez por año escolar.',
          style: TemaSuperaPaes.cuerpo.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        Aviso(tono: TonoAviso.info, texto: [_condiciones, ?cierre].join(' ')),
      ],
      pie: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PieConError(
            error: errorConTiempo ?? errorEmpezar,
            boton: FilledButton(
              onPressed: ocupado
                  ? null
                  : () => empezarConTiempo(
                      () => ref
                          .read(evaluacionConTiempoProvider.notifier)
                          .empezarDiagnostico(diagnostico.pruebaId),
                      alRechazar: () => ref.invalidate(
                        disponibilidadDiagnosticoProvider(diagnostico.pruebaId),
                      ),
                    ),
              child: empezandoConTiempo
                  ? const CargandoEnBoton()
                  : const Text('Rendir diagnóstico'),
            ),
          ),
          const SizedBox(height: 4),
          BotonTexto(
            onPressed: ocupado ? null : () => _ahoraNo(oferta),
            child: empezando
                ? const CargandoEnBoton()
                : Text(
                    desdePractica ? 'Ahora no, practicar igual' : 'Ahora no',
                  ),
          ),
        ],
      ),
    );
  }
}
