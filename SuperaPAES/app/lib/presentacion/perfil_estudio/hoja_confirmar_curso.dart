import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
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
  backgroundColor: TemaSuperaPaes.superficie,
  barrierColor: TemaSuperaPaes.texto.withValues(alpha: 0.9),
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
  ),
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

  Future<void> _confirmar(Curso curso) async {
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
      setState(() {
        _guardando = false;
        _error = error.mensaje;
      });
    }
  }

  /// «Corregir mi curso» abre A08 con el curso de hoy ya marcado.
  void _corregir() {
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
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: TemaSuperaPaes.bordeInput,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: TemaSuperaPaes.primarioSuave,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.calendar_today_outlined,
                  size: 20,
                  color: TemaSuperaPaes.primario,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Semantics(
              header: true,
              child: Text(
                'Comenzó el año escolar ${anioEscolar(DateTime.now())}',
                style: TemaSuperaPaes.h2,
              ),
            ),
            const SizedBox(height: 14),
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
            if (_error case final error?) ...[
              const SizedBox(height: 14),
              Aviso(tono: TonoAviso.error, texto: error),
            ],
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _guardando ? null : () => _confirmar(curso),
              child: _guardando
                  ? const CargandoEnBoton()
                  : Text(
                      curso.esEgresado
                          ? 'Sí, ya egresé'
                          : 'Sí, estoy en ${curso.nombre}',
                    ),
            ),
            const SizedBox(height: 14),
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
