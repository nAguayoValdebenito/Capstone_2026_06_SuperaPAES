import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/apertura/ambito_apertura.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

/// Entrada del logo de acceso, sin cambiar su espacio en el formulario.
/// Espera a que termine la apertura para no animarse mientras está cubierta.
class LogoAcceso extends StatefulWidget {
  const LogoAcceso({super.key});

  static const String recurso = 'assets/imagenes/logo_supera_paes.png';

  @override
  State<LogoAcceso> createState() => _LogoAccesoState();
}

class _LogoAccesoState extends State<LogoAcceso>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entrada = AnimationController(vsync: this);
  late final Animation<double> _escala = Tween<double>(
    begin: TemaSuperaPaes.escalaEntradaLogoAcceso,
    end: 1,
  ).animate(_entrada.drive(CurveTween(curve: TemaSuperaPaes.curvaEntrada)));
  bool _iniciada = false;
  bool _completaSinMovimiento = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _entrada.duration = duracion(context, TemaSuperaPaes.movimientoLento);
    if (reducirMovimiento(context)) {
      _iniciada = true;
      _completaSinMovimiento = true;
      _entrada.stop();
    } else if (!_iniciada && !AmbitoApertura.estaEnCurso(context)) {
      _iniciada = true;
      _entrada.forward();
    }
  }

  @override
  void dispose() {
    _entrada.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScaleTransition(
    scale: _completaSinMovimiento
        ? const AlwaysStoppedAnimation<double>(1)
        : _escala,
    child: Image.asset(
      LogoAcceso.recurso,
      width: TemaSuperaPaes.anchoLogoAcceso,
      height: TemaSuperaPaes.altoLogoAcceso,
      semanticLabel: Textos.nombreApp,
    ),
  );
}
