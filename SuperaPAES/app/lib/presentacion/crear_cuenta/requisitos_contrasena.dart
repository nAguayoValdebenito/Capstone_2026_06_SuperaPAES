import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

/// Solo marca como revisada una contraseña común si la API aceptó el registro.
/// El largo y la comparación con el correo usan las validaciones existentes.
class RequisitosContrasena extends StatelessWidget {
  const RequisitosContrasena({
    required this.contrasena,
    required this.correo,
    super.key,
    this.aceptadaPorServidor = false,
    this.comunRechazada = false,
  });

  final String contrasena;
  final String correo;
  final bool aceptadaPorServidor;
  final bool comunRechazada;

  @override
  Widget build(BuildContext context) {
    final largo = contrasena.runes.length;
    final cumpleLargo =
        largo >= ValidacionesRegistro.largoMinimoContrasena &&
        largo <= ValidacionesRegistro.largoMaximoContrasena;
    final distinta =
        contrasena.isNotEmpty &&
        ValidacionesRegistro.correo(correo) == null &&
        contrasena.trim().toLowerCase() != correo.trim().toLowerCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Requisito(
          clave: 'largo',
          texto:
              'De ${ValidacionesRegistro.largoMinimoContrasena} a '
              '${ValidacionesRegistro.largoMaximoContrasena} caracteres',
          cumplido: cumpleLargo,
        ),
        _Requisito(
          clave: 'correo',
          texto: 'Distinta de tu correo',
          cumplido: distinta,
        ),
        _Requisito(
          clave: 'comun',
          texto: 'No es una contraseña común',
          cumplido: aceptadaPorServidor,
          rechazada: comunRechazada,
          pendiente: 'Se revisa al crear la cuenta.',
        ),
      ],
    );
  }
}

class _Requisito extends StatelessWidget {
  const _Requisito({
    required this.clave,
    required this.texto,
    required this.cumplido,
    this.rechazada = false,
    this.pendiente,
  });

  final String clave;
  final String texto;
  final bool cumplido;
  final bool rechazada;
  final String? pendiente;

  @override
  Widget build(BuildContext context) {
    final estado = cumplido
        ? 'Cumplido'
        : (rechazada ? 'No cumplido' : 'Pendiente');
    final color = cumplido
        ? TemaSuperaPaes.exito
        : (rechazada ? TemaSuperaPaes.error : TemaSuperaPaes.textoSecundario);
    return Semantics(
      key: ValueKey('requisito-$clave'),
      label: '$estado: $texto',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.only(top: TemaSuperaPaes.espacio4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                cumplido
                    ? Icons.check_rounded
                    : (rechazada
                          ? Icons.close_rounded
                          : Icons.radio_button_unchecked),
                color: color,
                size: TemaSuperaPaes.espacio24,
              ),
              const SizedBox(width: TemaSuperaPaes.espacio8),
              Expanded(
                child: Text(
                  !cumplido && !rechazada && pendiente != null
                      ? '$texto. $pendiente'
                      : texto,
                  style: TemaSuperaPaes.pequeno.copyWith(color: color),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
