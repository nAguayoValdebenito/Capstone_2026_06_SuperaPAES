import 'dart:async';

import 'package:supera_paes/dominio/entidades/aviso_error.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_avisos.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Los cinco motivos de `contenido.motivo_reporte`.
const List<MotivoAviso> motivosDePrueba = [
  MotivoAviso(codigo: 'enunciado', nombre: 'Error en el enunciado'),
  MotivoAviso(codigo: 'alternativas', nombre: 'Error en las alternativas'),
  MotivoAviso(codigo: 'respuesta', nombre: 'La respuesta correcta está mal'),
  MotivoAviso(codigo: 'explicacion', nombre: 'Error en la explicación'),
  MotivoAviso(codigo: 'otro', nombre: 'Otro'),
];

/// Repositorio de avisos sin red. Guarda lo enviado en [enviados]. Con
/// [errorEnvio], el envío falla; con [errorMotivos], la lista de motivos.
/// Con [espera], el envío termina cuando se completa.
class RepositorioAvisosFalso implements RepositorioAvisos {
  RepositorioAvisosFalso({this.errorEnvio, this.errorMotivos});

  ErrorApi? errorEnvio;
  ErrorApi? errorMotivos;
  Completer<void>? espera;
  final List<DatosAviso> enviados = [];

  @override
  Future<List<MotivoAviso>> motivos() async {
    if (errorMotivos case final error?) throw error;
    return motivosDePrueba;
  }

  @override
  Future<AvisoEnviado> enviar(DatosAviso datos) async {
    await espera?.future;
    if (errorEnvio case final error?) throw error;
    enviados.add(datos);
    final motivo = motivosDePrueba.firstWhere((m) => m.codigo == datos.motivo);
    return AvisoEnviado(id: '${enviados.length}', motivo: motivo.nombre);
  }
}
