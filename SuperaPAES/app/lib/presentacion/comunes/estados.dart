import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';

/// Estados de carga, vacío y error de las pantallas (plan de mejora visual
/// del 02/11): reemplazan la rueda centrada y el recuadro rojo, que hacían
/// saltar la pantalla y alarmaban de más. Los textos de cada pantalla los
/// pone quien la usa.

/// Un solo controlador por pantalla: todos los [Bloque] de dentro laten
/// juntos (de `neutroSuave` a `borde`, 1.200 ms en ciclo, lineal) y el lector
/// de pantalla dice «Cargando» una sola vez. Con [quieto] (sin conexión) o
/// con «reducir movimiento» el gris queda fijo.
class GrupoEsqueleto extends StatefulWidget {
  const GrupoEsqueleto({required this.child, super.key, this.quieto = false});

  final Widget child;
  final bool quieto;

  /// ¿Hay un grupo sobre [context]?
  static bool existe(BuildContext context) =>
      context.getInheritedWidgetOfExactType<_Latido>() != null;

  @override
  State<GrupoEsqueleto> createState() => _GrupoEsqueletoState();
}

class _GrupoEsqueletoState extends State<GrupoEsqueleto>
    with SingleTickerProviderStateMixin {
  late final AnimationController _latido = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ajustar();
  }

  @override
  void didUpdateWidget(GrupoEsqueleto anterior) {
    super.didUpdateWidget(anterior);
    _ajustar();
  }

  void _ajustar() {
    if (widget.quieto || reducirMovimiento(context)) {
      _latido
        ..stop()
        ..value = 0;
    } else if (!_latido.isAnimating) {
      _latido.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _latido.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: widget.quieto ? null : 'Cargando',
    child: _Latido(animacion: _latido, child: widget.child),
  );
}

class _Latido extends InheritedNotifier<Animation<double>> {
  const _Latido({required Animation<double> animacion, required super.child})
    : super(notifier: animacion);
}

/// Un bloque gris con la forma de lo que va a aparecer. Late con el
/// [GrupoEsqueleto] que lo contiene.
class Bloque extends StatelessWidget {
  const Bloque({
    super.key,
    this.ancho,
    this.alto = 16,
    this.radio = TemaSuperaPaes.radioChico,
  });

  /// `null`: todo el ancho disponible.
  final double? ancho;
  final double alto;
  final double radio;

  @override
  Widget build(BuildContext context) {
    final latido = context
        .dependOnInheritedWidgetOfExactType<_Latido>()
        ?.notifier;
    return ExcludeSemantics(
      child: Container(
        width: ancho,
        height: alto,
        decoration: BoxDecoration(
          color: Color.lerp(
            TemaSuperaPaes.neutroSuave,
            TemaSuperaPaes.borde,
            latido?.value ?? 0,
          ),
          borderRadius: BorderRadius.circular(radio),
        ),
      ),
    );
  }
}

/// Esqueleto de una tarjeta: un título y [lineas] de texto, dentro de una
/// tarjeta blanca. Si no hay un [GrupoEsqueleto] encima, crea el suyo.
class EsqueletoTarjeta extends StatelessWidget {
  const EsqueletoTarjeta({super.key, this.lineas = 2});

  final int lineas;

  @override
  Widget build(BuildContext context) {
    final tarjeta = Container(
      padding: const EdgeInsets.all(TemaSuperaPaes.espacio16),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.superficie,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
        border: Border.all(color: TemaSuperaPaes.borde),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Bloque(ancho: 140, alto: 20),
          for (var i = 0; i < lineas; i++) ...[
            const SizedBox(height: TemaSuperaPaes.espacio12),
            Bloque(ancho: i == lineas - 1 ? 180 : null),
          ],
        ],
      ),
    );
    return GrupoEsqueleto.existe(context)
        ? tarjeta
        : GrupoEsqueleto(child: tarjeta);
  }
}

/// Lo que se muestra cuando no hay nada todavía: el trazo, un título, un
/// texto que dice qué hacer y, si hay, un botón.
class EstadoVacio extends StatelessWidget {
  const EstadoVacio({
    required this.titulo,
    required this.texto,
    super.key,
    this.accion,
    this.alTocar,
  });

  final String titulo;
  final String texto;

  /// Texto del botón; sin él (o sin [alTocar]) no hay botón.
  final String? accion;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    return _ConTrazo(
      trazo: const Trazo(ancho: 64),
      titulo: titulo,
      texto: texto,
      boton: switch ((accion, alTocar)) {
        (final etiqueta?, final tocar?) => FilledButton(
          onPressed: tocar,
          child: Text(etiqueta),
        ),
        _ => null,
      },
    );
  }
}

/// Lo que no se pudo cargar, en tono neutro y no en rojo: el trazo a medio
/// camino, el mensaje de la API (que ya viene en español claro) o
/// [mensaje] si el error es otro, y «Reintentar».
///
/// Un error que no viene de la API (no de red ni del servidor) se anota en
/// la consola en depuración, para poder ver su causa: así se busca un fallo
/// como el de la tarjeta del diagnóstico de A25 (paso 55).
class EstadoError extends StatefulWidget {
  const EstadoError({
    required this.error,
    required this.mensaje,
    required this.alReintentar,
    super.key,
    this.titulo,
  });

  final Object error;
  final String mensaje;
  final VoidCallback alReintentar;

  /// Título opcional sobre el mensaje, como «No pudimos cargar tu progreso».
  final String? titulo;

  @override
  State<EstadoError> createState() => _EstadoErrorState();
}

class _EstadoErrorState extends State<EstadoError> {
  @override
  void initState() {
    super.initState();
    registrarErrorInesperado(widget.error);
  }

  @override
  void didUpdateWidget(EstadoError anterior) {
    super.didUpdateWidget(anterior);
    if (!identical(anterior.error, widget.error)) {
      registrarErrorInesperado(widget.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = widget.error;
    return Semantics(
      liveRegion: true,
      child: _ConTrazo(
        trazo: const Trazo(
          ancho: 64,
          color: TemaSuperaPaes.textoSecundario,
          avance: 0.6,
        ),
        titulo: widget.titulo,
        texto: error is ErrorApi ? error.mensaje : widget.mensaje,
        boton: OutlinedButton(
          onPressed: widget.alReintentar,
          child: const Text('Reintentar'),
        ),
      ),
    );
  }
}

/// Anota en la consola, solo en depuración, un error que no vino de la API:
/// la pantalla muestra un texto general y sin esto no se sabría la causa.
void registrarErrorInesperado(Object error) {
  if (!kDebugMode || error is ErrorApi) return;
  debugPrint('Error inesperado al cargar (${error.runtimeType}): $error');
}

/// El trazo, el título, el texto y el botón, centrados.
class _ConTrazo extends StatelessWidget {
  const _ConTrazo({
    required this.trazo,
    required this.texto,
    this.titulo,
    this.boton,
  });

  final Widget trazo;
  final String? titulo;
  final String texto;
  final Widget? boton;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: TemaSuperaPaes.espacio16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(child: trazo),
          const SizedBox(height: TemaSuperaPaes.espacio16),
          if (titulo case final encabezado?) ...[
            Semantics(
              header: true,
              child: Text(
                encabezado,
                textAlign: TextAlign.center,
                style: TemaSuperaPaes.h2,
              ),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio8),
          ],
          Text(
            texto,
            textAlign: TextAlign.center,
            style: TemaSuperaPaes.cuerpo.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          if (boton case final accion?) ...[
            const SizedBox(height: TemaSuperaPaes.espacio16),
            accion,
          ],
        ],
      ),
    );
  }
}
