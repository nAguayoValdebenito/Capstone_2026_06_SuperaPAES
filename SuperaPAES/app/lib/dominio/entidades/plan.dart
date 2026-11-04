/// Un plan que se ofrece (A43; HU-43, CU-12 paso 1, RN-05). El plan Gratis no
/// viene de la API: lo muestra la pantalla.
class PlanOfrecido {
  const PlanOfrecido({
    required this.id,
    required this.alcance,
    required this.alcanceNombre,
    required this.periodicidad,
    required this.precioClp,
  });

  final int id;

  /// `una_prueba` o `todas`.
  final String alcance;

  /// «Una prueba» o «Todas las pruebas».
  final String alcanceNombre;

  /// `mensual` o `anual`.
  final String periodicidad;
  final int precioClp;

  bool get esAnual => periodicidad == 'anual';
  bool get esUnaPrueba => alcance == 'una_prueba';

  /// «$15.990».
  String get precio {
    final digitos = '$precioClp';
    final conPuntos = digitos.replaceAllMapped(
      RegExp(r'\d(?=(\d{3})+$)'),
      (cifra) => '${cifra[0]}.',
    );
    return '\$$conPuntos';
  }
}
