import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/perfil_estudio/borrador_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Muestra A11 · Confirmar el curso en marzo (HU-29 esc. 8, CU-05 1.a) sobre
/// Inicio. No se cierra tocando afuera: el estudiante confirma o corrige.
Future<void> mostrarConfirmarCurso(
  BuildContext context,
  PerfilEstudiante perfil,
) => showModalBottomSheet<void>(
  context: context,
  // Sobre la barra inferior, como en el boceto.
  useRootNavigator: true,
  isDismissible: false,
  enableDrag: false,
  isScrollControlled: true,
  // No se puede arrastrar: sin asa.
  showDragHandle: false,
  barrierColor: TemaSuperaPaes.texto.withValues(alpha: 0.9),
  builder: (context) => HojaConfirmarCurso(perfil: perfil),
);

class HojaConfirmarCurso extends ConsumerStatefulWidget {
  const HojaConfirmarCurso({required this.perfil, super.key});

  final PerfilEstudiante perfil;

  @override
  ConsumerState<HojaConfirmarCurso> createState() => _HojaConfirmarCursoState();
}

class _HojaConfirmarCursoState extends ConsumerState<HojaConfirmarCurso> {
  bool _guardando = false;
  String? _error;
  int _intentosFallidos = 0;

  Future<void> _confirmar(Curso curso) async {
    if (_guardando) return;
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      await ref
          .read(perfilProvider.notifier)
          .confirmarCurso(
            curso.codigo,
            anioEgreso: curso.esEgresado ? widget.perfil.anioEgreso : null,
          );
      if (mounted) Navigator.of(context).pop();
    } on ErrorApi catch (error) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _error = error.mensaje;
        _intentosFallidos++;
      });
    }
  }

  /// «Corregir mi curso» abre A08 con el curso de hoy ya marcado.
  void _corregir() {
    if (_guardando) return;
    ref
        .read(borradorPerfilProvider.notifier)
        .iniciar(ModoPerfil.correccion, widget.perfil);
    final enrutador = GoRouter.of(context);
    Navigator.of(context).pop();
    unawaited(enrutador.push(Rutas.perfilCurso));
  }

  @override
  Widget build(BuildContext context) {
    final curso = widget.perfil.curso;
    if (curso == null) return const SizedBox.shrink();
    final gris = TemaSuperaPaes.cuerpo.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    const fuerte = TextStyle(fontWeight: FontWeight.w700);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          TemaSuperaPaes.espacio24,
          TemaSuperaPaes.espacio24,
          TemaSuperaPaes.espacio24,
          TemaSuperaPaes.espacio32,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Align(
              alignment: Alignment.centerLeft,
              child: IconoEnCirculo(icono: Icons.calendar_today_outlined),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio16),
            Text(
              'Comenzó el año escolar ${anioEscolar(DateTime.now())}',
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio8),
            Semantics(
              header: true,
              child: Text(
                curso.esEgresado
                    ? '¿Ya egresaste de 4° medio?'
                    : '¿Sigues en ${curso.nombre}?',
                style: TemaSuperaPaes.numero,
              ),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio16),
            Text.rich(
              curso.esEgresado
                  ? const TextSpan(
                      text:
                          'Según tu perfil, ya egresaste de 4° medio. Desde '
                          'ahora verás todos los contenidos de cada prueba.',
                    )
                  : TextSpan(
                      children: [
                        const TextSpan(
                          text: 'Según tu perfil, este año estás en ',
                        ),
                        TextSpan(text: curso.nombre, style: fuerte),
                        TextSpan(
                          text:
                              '. Desde ahora verás también los contenidos de '
                              '${curso.nombre}.',
                        ),
                      ],
                    ),
              style: gris,
            ),
            const SizedBox(height: TemaSuperaPaes.espacio24),
            BotonPrincipal(
              texto: curso.esEgresado
                  ? 'Sí, ya egresé'
                  : 'Sí, estoy en ${curso.nombre}',
              onPressed: () => _confirmar(curso),
              estado: _guardando
                  ? EstadoBoton.cargando
                  : _error != null
                  ? EstadoBoton.error
                  : EstadoBoton.normal,
              error: _error,
              intentosFallidos: _intentosFallidos,
            ),
            const SizedBox(height: TemaSuperaPaes.espacio12),
            OutlinedButton(
              onPressed: _guardando ? null : _corregir,
              child: const Text('Corregir mi curso'),
            ),
          ],
        ),
      ),
    );
  }
}
