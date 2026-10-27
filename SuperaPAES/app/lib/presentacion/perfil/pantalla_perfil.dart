import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/perfil_estudio/borrador_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Pestaña Perfil (A37; HU-29 esc. 9, HU-02 esc. 3, CU-05 1.b): la cuenta, el
/// perfil de estudio con «Editar», los accesos a suscripción, invitaciones,
/// datos y documentos legales, y cerrar sesión.
class PantallaPerfil extends ConsumerWidget {
  const PantallaPerfil({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estudiante = ref.watch(sesionProvider).value?.estudiante;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        if (estudiante != null) _Cuenta(estudiante: estudiante),
        const _PerfilDeEstudio(),
        ListaDeFilas(
          filas: [
            FilaNavegacion(
              texto: 'Mi suscripción',
              onTap: () => context.push(Rutas.planes),
            ),
            FilaNavegacion(
              texto: 'Invitar y ganar preguntas',
              onTap: () => context.push(Rutas.invitaciones),
            ),
            FilaNavegacion(
              texto: 'Mis datos y privacidad',
              onTap: () => context.push(Rutas.misDatos),
            ),
            FilaNavegacion(
              texto: 'Términos y privacidad',
              onTap: () => context.push(Rutas.terminos),
            ),
          ],
        ),
        const _BotonCerrarSesion(),
      ],
    );
  }
}

/// Inicial, nombre, correo y, si falta, «Sin verificar».
class _Cuenta extends StatelessWidget {
  const _Cuenta({required this.estudiante});

  final Estudiante estudiante;

  @override
  Widget build(BuildContext context) {
    final inicial = estudiante.nombre.trim().characters.firstOrNull ?? '?';
    return Row(
      children: [
        Container(
          width: 56,
          height: 56,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: TemaSuperaPaes.primario,
            shape: BoxShape.circle,
          ),
          child: ExcludeSemantics(
            child: Text(
              inicial.toUpperCase(),
              style: TemaSuperaPaes.h1.copyWith(
                color: TemaSuperaPaes.superficie,
              ),
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(estudiante.nombre, style: TemaSuperaPaes.h2),
              ),
              const SizedBox(height: 2),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    estudiante.correo,
                    style: TemaSuperaPaes.pequeno.copyWith(
                      color: TemaSuperaPaes.textoSecundario,
                    ),
                  ),
                  if (!estudiante.correoVerificado)
                    const Etiqueta(
                      texto: 'Sin verificar',
                      tono: TonoEtiqueta.aviso,
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// «Mi perfil de estudio» con sus datos y «Editar», que abre los tres pasos
/// con el perfil guardado.
class _PerfilDeEstudio extends ConsumerWidget {
  const _PerfilDeEstudio();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfil = ref.watch(perfilProvider);
    final opciones = ref.watch(opcionesPerfilProvider);
    final guardado = perfil.value;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Mi perfil de estudio', style: TemaSuperaPaes.h2),
              ),
              if (guardado != null)
                TextButton(
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: () async {
                    ref
                        .read(borradorPerfilProvider.notifier)
                        .iniciar(ModoPerfil.edicion, guardado);
                    await context.push(Rutas.perfilCurso);
                  },
                  child: const Text('Editar'),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (perfil.hasError || opciones.hasError)
            Aviso(
              tono: TonoAviso.error,
              texto: switch (perfil.error ?? opciones.error) {
                final ErrorApi error => error.mensaje,
                _ => 'No se pudo cargar tu perfil.',
              },
            )
          else if (guardado == null || !opciones.hasValue)
            const Center(child: CircularProgressIndicator())
          else
            _DatosDelPerfil(perfil: guardado, opciones: opciones.requireValue),
        ],
      ),
    );
  }
}

class _DatosDelPerfil extends StatelessWidget {
  const _DatosDelPerfil({required this.perfil, required this.opciones});

  final PerfilEstudiante perfil;
  final OpcionesPerfil opciones;

  @override
  Widget build(BuildContext context) {
    final curso = perfil.curso;
    final pruebas = [
      for (final id in perfil.pruebas) ?opciones.prueba(id)?.nombreCorto,
    ];
    final areas = [
      for (final id in perfil.areasCarrera) ?opciones.area(id)?.nombre,
    ];
    final electivo = perfil.electivoId == null
        ? null
        : opciones.electivo(perfil.electivoId!);
    final reforzar = perfil.pruebaReforzarId == null
        ? null
        : opciones.prueba(perfil.pruebaReforzarId!)?.nombreCorto;
    final filas = [
      if (curso != null)
        FilaDato(
          etiqueta: 'Curso',
          valor: '${curso.nombre} (egreso ${perfil.anioEgreso})',
        ),
      FilaDato(
        etiqueta: 'Pruebas',
        valor: pruebas.isEmpty ? 'Sin elegir' : pruebas.join(', '),
      ),
      if (electivo != null)
        FilaDato(etiqueta: 'Electivo de Ciencias', valor: electivo),
      FilaDato(etiqueta: 'Prueba a reforzar', valor: reforzar ?? 'Ninguna'),
      FilaDato(
        etiqueta: 'Áreas de carrera',
        valor: areas.isEmpty ? 'Ninguna' : areas.join(', '),
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final fila in filas) ...[fila, const SizedBox(height: 10)],
        Text(
          'Los cambios rigen desde tu siguiente práctica; las evaluaciones '
          'rendidas conservan su curso.',
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
      ],
    );
  }
}

/// Cierra la sesión en la API y en el teléfono. Sin sesión, el enrutador
/// lleva a Iniciar sesión.
class _BotonCerrarSesion extends ConsumerStatefulWidget {
  const _BotonCerrarSesion();

  @override
  ConsumerState<_BotonCerrarSesion> createState() => _BotonCerrarSesionState();
}

class _BotonCerrarSesionState extends ConsumerState<_BotonCerrarSesion> {
  bool _cerrando = false;

  Future<void> _cerrar() async {
    setState(() => _cerrando = true);
    await ref.read(sesionProvider.notifier).cerrar();
    if (mounted) setState(() => _cerrando = false);
  }

  @override
  Widget build(BuildContext context) {
    // Botón Contorno a lo ancho, como en el boceto A37.
    return OutlinedButton(
      onPressed: _cerrando ? null : _cerrar,
      child: const Text('Cerrar sesión'),
    );
  }
}
