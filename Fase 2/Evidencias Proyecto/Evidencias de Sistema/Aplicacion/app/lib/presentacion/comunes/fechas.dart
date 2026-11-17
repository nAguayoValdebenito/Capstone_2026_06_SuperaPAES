// Fechas en español para la interfaz: «19/10», «18/10/2026», «6 de
// noviembre» y «6 de diciembre de 2026».

/// «19/10».
String fechaCorta(DateTime fecha) => '${_dos(fecha.day)}/${_dos(fecha.month)}';

/// «18/10/2026», en la hora del teléfono.
String fechaLarga(DateTime fecha) {
  final local = fecha.toLocal();
  return '${_dos(local.day)}/${_dos(local.month)}/${local.year}';
}

const List<String> _meses = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/// «6 de noviembre», en la hora del teléfono, como en el Historial (A34).
String fechaEnPalabras(DateTime fecha) {
  final local = fecha.toLocal();
  return '${local.day} de ${_meses[local.month - 1]}';
}

/// «6 de diciembre de 2026», en la hora del teléfono (A44).
String fechaConAnio(DateTime fecha) =>
    '${fechaEnPalabras(fecha)} de ${fecha.toLocal().year}';

String _dos(int numero) => numero.toString().padLeft(2, '0');
