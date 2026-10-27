/// Lee un id de la API. La API entrega los ids como números enteros
/// positivos (api/comun/ids-respuesta.ts); también acepta un texto con
/// dígitos, como los guardaba la API antes y como quedaron en las sesiones
/// guardadas en el teléfono.
int leerId(Object? valor) {
  final id = switch (valor) {
    final int numero => numero,
    final String texto => int.tryParse(texto),
    _ => null,
  };
  if (id == null || id <= 0) {
    throw FormatException('El id no es un entero positivo.', valor);
  }
  return id;
}
