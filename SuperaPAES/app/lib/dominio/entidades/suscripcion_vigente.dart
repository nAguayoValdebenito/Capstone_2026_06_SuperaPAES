/// Tienda en que se compró la suscripción: solo ella la puede cancelar
/// (RN-34).
enum Tienda {
  googlePlay('Google Play'),
  appStore('App Store');

  const Tienda(this.nombre);

  final String nombre;
}

/// La suscripción activa o en mora que la tienda sigue cobrando (RN-34): al
/// borrar la cuenta, A42b avisa que hay que cancelarla en la tienda.
class SuscripcionVigente {
  const SuscripcionVigente({
    required this.enMora,
    required this.plan,
    required this.periodicidad,
    required this.tienda,
  });

  /// `false` si está activa.
  final bool enMora;

  /// «Una prueba» o «Todas las pruebas».
  final String plan;

  /// `mensual` o `anual`.
  final String periodicidad;
  final Tienda tienda;
}
