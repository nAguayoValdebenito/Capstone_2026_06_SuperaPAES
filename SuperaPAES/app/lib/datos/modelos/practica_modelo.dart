import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee y arma el JSON de la práctica (docs/contratos/HU-30.md y HU-34.md):
/// GET /temario/opciones-practica, POST /evaluaciones/practicas, su
/// siguiente pregunta, la respuesta y el cierre.
abstract final class PracticaModelo {
  static OpcionConNombre _opcion(Object? valor) {
    final json = valor! as Map<String, dynamic>;
    return (id: leerId(json['id']), nombre: json['nombre'] as String);
  }

  static List<OpcionConNombre> _opciones(Object? lista) => [
    for (final valor in lista! as List<Object?>) _opcion(valor),
  ];

  static OpcionesPractica opciones(Map<String, dynamic> json) =>
      OpcionesPractica(
        dificultades: [
          for (final valor in json['dificultades'] as List<Object?>)
            _dificultad(valor! as Map<String, dynamic>),
        ],
        pruebas: [
          for (final valor in json['pruebas'] as List<Object?>)
            _prueba(valor! as Map<String, dynamic>),
        ],
      );

  static Dificultad _dificultad(Map<String, dynamic> json) => Dificultad(
    id: leerId(json['id']),
    codigo: json['codigo'] as String,
    nombre: json['nombre'] as String,
    mezcla: json['mezcla'] as int,
  );

  static PruebaPractica _prueba(Map<String, dynamic> json) => PruebaPractica(
    id: leerId(json['id']),
    codigo: json['codigo'] as String,
    ejes: [
      for (final valor in json['ejes'] as List<Object?>)
        _eje(valor! as Map<String, dynamic>),
    ],
    habilidades: _opciones(json['habilidades']),
  );

  static EjePractica _eje(Map<String, dynamic> json) => EjePractica(
    id: leerId(json['id']),
    nombre: json['nombre'] as String,
    contenidos: _opciones(json['contenidos']),
  );

  /// Cuerpo de POST /evaluaciones/practicas: un solo alcance y, sin
  /// dificultad, la mezcla.
  static Map<String, Object?> datos(DatosPractica datos) {
    final campoAlcance = switch (datos.alcance.tipo) {
      TipoAlcance.prueba => null,
      TipoAlcance.eje => 'ejeId',
      TipoAlcance.contenido => 'contenidoId',
      TipoAlcance.habilidad => 'habilidadId',
    };
    return {
      'pruebaId': datos.pruebaId,
      ?campoAlcance: datos.alcance.id,
      'dificultadId': ?datos.dificultadId,
      'cantidad': datos.cantidad,
    };
  }

  static PracticaIniciada iniciada(Map<String, dynamic> json) =>
      PracticaIniciada(
        id: leerId(json['id']),
        pruebaId: leerId(json['pruebaId']),
        cantidad: json['cantidad'] as int,
      );

  static PreguntaDePractica pregunta(Map<String, dynamic> json) {
    final texto = json['texto'] as Map<String, dynamic>?;
    return PreguntaDePractica(
      itemId: leerId(json['id']),
      orden: json['orden'] as int,
      total: json['total'] as int,
      enunciado: json['enunciado'] as String,
      texto: texto == null
          ? null
          : TextoDeLectura(
              titulo: texto['titulo'] as String?,
              contenido: texto['contenido'] as String?,
              imagen: texto['imagen'] as String?,
            ),
      alternativas: [
        for (final valor in json['alternativas'] as List<Object?>)
          _alternativa(valor! as Map<String, dynamic>),
      ],
    );
  }

  static AlternativaVisible _alternativa(Map<String, dynamic> json) =>
      AlternativaVisible(
        id: leerId(json['id']),
        letra: json['letra'] as String,
        texto: json['texto'] as String,
      );

  static Correccion correccion(Map<String, dynamic> json) => Correccion(
    esCorrecta: json['esCorrecta'] == true,
    alternativaElegidaId: leerId(json['alternativaElegidaId']),
    alternativaCorrectaId: leerId(json['alternativaCorrectaId']),
    explicacion: json['explicacion'] as String?,
    alternativas: [
      for (final valor in json['alternativas'] as List<Object?>? ?? const [])
        _alternativaCorregida(valor! as Map<String, dynamic>),
    ],
  );

  static AlternativaCorregida _alternativaCorregida(
    Map<String, dynamic> json,
  ) => AlternativaCorregida(
    id: leerId(json['id']),
    letra: json['letra'] as String,
    texto: json['texto'] as String,
    explicacion: json['explicacion'] as String?,
  );

  static ResumenPractica resumen(Map<String, dynamic> json) {
    final prueba = json['prueba'] as Map<String, dynamic>;
    final alcance = json['alcance'] as Map<String, dynamic>;
    final dificultad = json['dificultad'] as Map<String, dynamic>;
    return ResumenPractica(
      id: leerId(json['id']),
      prueba: nombreDePrueba(
        prueba['codigo'] as String,
        prueba['nombre'] as String,
      ),
      alcance: Alcance(
        TipoAlcance.values.byName(alcance['tipo'] as String),
        id: leerId(alcance['id']),
        nombre: alcance['nombre'] as String,
      ),
      dificultad: dificultad['nombre'] as String,
      cantidad: json['cantidad'] as int,
      correctas: json['correctas'] as int,
      incorrectas: json['incorrectas'] as int,
      omitidas: json['omitidas'] as int,
      porcentaje: (json['porcentaje'] as num).toDouble(),
      tiempoUsadoSeg: json['tiempoUsadoSeg'] as int,
    );
  }

  /// `data` de GET /evaluaciones/abierta (docs/contratos/HU-60.md).
  static ConsultaEvaluacionAbierta evaluacionAbierta(
    Map<String, dynamic> json,
  ) {
    final abierta = json['abierta'] as Map<String, dynamic>?;
    final cerrada = json['cerrada'] as Map<String, dynamic>?;
    return ConsultaEvaluacionAbierta(
      abierta: abierta == null ? null : _abierta(abierta),
      cerrada: cerrada == null
          ? null
          : EvaluacionRecienCerrada(
              id: leerId(cerrada['id']),
              tipoNombre:
                  (cerrada['tipo'] as Map<String, dynamic>)['nombre'] as String,
              porTiempo: cerrada['estado'] == 'tiempo_agotado',
            ),
    );
  }

  static EvaluacionAbierta _abierta(Map<String, dynamic> json) {
    final tipo = json['tipo'] as Map<String, dynamic>;
    final prueba = json['prueba'] as Map<String, dynamic>;
    final alcance = json['alcance'] as Map<String, dynamic>;
    final tipoAlcance = TipoAlcance.values.byName(alcance['tipo'] as String);
    final dificultad = json['dificultad'] as Map<String, dynamic>;
    return EvaluacionAbierta(
      id: leerId(json['id']),
      tipo: tipo['codigo'] as String,
      tipoNombre: tipo['nombre'] as String,
      pruebaId: leerId(prueba['id']),
      prueba: nombreDePrueba(
        prueba['codigo'] as String,
        prueba['nombre'] as String,
      ),
      // Toda la prueba va sin nombre, como al iniciar: A17 ya nombra la prueba.
      alcance: tipoAlcance == TipoAlcance.prueba
          ? Alcance.todaLaPrueba
          : Alcance(
              tipoAlcance,
              id: leerId(alcance['id']),
              nombre: alcance['nombre'] as String,
            ),
      dificultadId: switch (dificultad['id']) {
        null => null,
        final id => leerId(id),
      },
      cantidad: json['cantidad'] as int,
      respondidas: json['respondidas'] as int,
      segundosRestantes: json['segundosRestantes'] as int?,
    );
  }
}
