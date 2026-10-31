import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/datos/fuentes/fuente_resultados_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_resultados_api.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_resultados.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Resultado y revisión (HU-61): sus rutas exigen sesión, así que van con el
/// cliente que agrega el token y lo renueva.
final repositorioResultadosProvider = Provider<RepositorioResultados>(
  (ref) => RepositorioResultadosApi(
    FuenteResultadosRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// La evaluación cuyo resultado o revisión se está viendo (A30 y A33).
class EvaluacionConsultada extends Notifier<int?> {
  @override
  int? build() => null;

  int? get evaluacion => state;
  set evaluacion(int? id) => state = id;
}

final evaluacionConsultadaProvider =
    NotifierProvider<EvaluacionConsultada, int?>(EvaluacionConsultada.new);

/// El resultado de la evaluación consultada; `null` si no hay una.
final resultadoProvider = FutureProvider<ResultadoEvaluacion?>((ref) async {
  final id = ref.watch(evaluacionConsultadaProvider);
  if (id == null) return null;
  return await ref.watch(repositorioResultadosProvider).obtenerResultado(id);
});

/// Las preguntas revisadas de la evaluación consultada; `null` si no hay una.
final revisionProvider = FutureProvider<List<PreguntaRevisada>?>((ref) async {
  final id = ref.watch(evaluacionConsultadaProvider);
  if (id == null) return null;
  return await ref.watch(repositorioResultadosProvider).obtenerRevision(id);
});

/// Abre el resultado de la evaluación (A30, A32): desde la entrega (HU-40) y
/// el historial (HU-62).
Future<void> abrirResultado(BuildContext context, WidgetRef ref, int id) {
  ref.read(evaluacionConsultadaProvider.notifier).evaluacion = id;
  return context.push(Rutas.resultado);
}

/// Abre la revisión pregunta por pregunta (A33): desde A30 y desde «Ver la
/// revisión» del resumen de la práctica (A21).
Future<void> abrirRevision(BuildContext context, WidgetRef ref, int id) {
  ref.read(evaluacionConsultadaProvider.notifier).evaluacion = id;
  return context.push(Rutas.revision);
}
