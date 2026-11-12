import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/perfil_estudio/borrador_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';

/// Pestaña Perfil (A37; HU-29 esc. 9, HU-02 esc. 3, CU-05 1.b): la cuenta,
/// el aviso para verificar el correo, los accesos a suscripción,
/// invitaciones y datos, los documentos legales con su versión, el perfil de
/// estudio con «Editar» y cerrar sesión.
class PantallaPerfil extends ConsumerWidget {
  const PantallaPerfil({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estudiante = ref.watch(sesionProvider).value?.estudiante;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        if (estudiante != null) _Cuenta(estudiante: estudiante),
        if (estudiante != null && !estudiante.correoVerificado)
          const _AvisoVerificar(),
        const _Accesos(),
        const TituloSeccion('Legal'),
        const _Legal(),
        const _PerfilDeEstudio(),
        const _BotonCerrarSesion(),
      ],
    );
  }
}

/// Inicial en un círculo, nombre, correo y, si falta, «Sin verificar».
class _Cuenta extends StatelessWidget {
  const _Cuenta({required this.estudiante});

  final Estudiante estudiante;

  @override
  Widget build(BuildContext context) {
    final inicial = estudiante.nombre.trim().characters.firstOrNull ?? '?';
    return Row(
      children: [
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: TemaSuperaPaes.primarioSuave,
            shape: BoxShape.circle,
          ),
          child: ExcludeSemantics(
            child: Text(
              inicial.toUpperCase(),
              style: TemaSuperaPaes.h1.copyWith(
                color: TemaSuperaPaes.primarioOscuro,
              ),
            ),
          ),
        ),
        const SizedBox(width: TemaSuperaPaes.espacio16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  estudiante.nombre,
                  style: TemaSuperaPaes.h1.copyWith(fontSize: 22),
                ),
              ),
              Text(
                estudiante.correo,
                style: TemaSuperaPaes.pequeno.copyWith(
                  color: TemaSuperaPaes.textoSecundario,
                ),
              ),
              if (!estudiante.correoVerificado) ...[
                const SizedBox(height: TemaSuperaPaes.espacio4),
                const Etiqueta(
                  texto: 'Sin verificar',
                  tono: TonoEtiqueta.aviso,
                  icono: Icons.mark_email_unread_rounded,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// «Verifica tu correo y pasa de 10 a 20 preguntas diarias.» con
/// «Verificar», que abre A06 (RN-01).
class _AvisoVerificar extends StatelessWidget {
  const _AvisoVerificar();

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(
                child: Icon(
                  Icons.mark_email_unread_rounded,
                  size: 20,
                  color: TemaSuperaPaes.primario,
                ),
              ),
              SizedBox(width: TemaSuperaPaes.espacio8),
              Expanded(
                child: Text(
                  'Verifica tu correo y pasa de 10 a 20 preguntas diarias.',
                  style: TemaSuperaPaes.pequeno,
                ),
              ),
            ],
          ),
          const SizedBox(height: TemaSuperaPaes.espacio12),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, TemaSuperaPaes.altoBotonChico),
              padding: const EdgeInsets.symmetric(
                horizontal: TemaSuperaPaes.espacio16,
              ),
              textStyle: TemaSuperaPaes.botonNormal,
              foregroundColor: TemaSuperaPaes.primario,
            ),
            onPressed: () => context.push(Rutas.verificarCorreo),
            child: const Text('Verificar'),
          ),
        ],
      ),
    );
  }
}

/// Mi suscripción, Invitar y Mis datos, con su ícono y una bajada.
class _Accesos extends ConsumerWidget {
  const _Accesos();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suscripcion = ref.watch(suscripcionActualProvider);
    final plan = switch (suscripcion) {
      AsyncData(value: final vigente?) => vigente.plan,
      AsyncData() => 'Plan Gratis',
      _ => null,
    };
    return ListaDeFilas(
      filas: [
        FilaNavegacion(
          texto: 'Mi suscripción',
          detalle: plan,
          icono: Icons.workspace_premium_outlined,
          onTap: () => context.push(Rutas.miSuscripcion),
        ),
        FilaNavegacion(
          texto: 'Invitar y ganar preguntas',
          detalle: '5 preguntas extra por cada invitado',
          icono: Icons.redeem_rounded,
          onTap: () => context.push(Rutas.invitaciones),
        ),
        FilaNavegacion(
          texto: 'Mis datos y privacidad',
          detalle: 'Descargar, permisos y borrar tu cuenta',
          icono: Icons.shield_rounded,
          onTap: () => context.push(Rutas.misDatos),
        ),
      ],
    );
  }
}

/// Términos y Política de privacidad con la versión vigente (CU-14 paso 2).
class _Legal extends ConsumerWidget {
  const _Legal();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vigentes = ref.watch(documentosVigentesProvider).value;
    String? version(TipoDocumentoLegal tipo) =>
        switch (vigentes?.where((d) => d.tipo == tipo).firstOrNull) {
          final documento? => 'Versión ${documento.version}',
          null => null,
        };
    return ListaDeFilas(
      filas: [
        FilaNavegacion(
          texto: 'Términos y condiciones',
          detalle: version(TipoDocumentoLegal.terminos),
          icono: Icons.description_rounded,
          onTap: () => context.push(Rutas.terminos),
        ),
        FilaNavegacion(
          texto: 'Política de privacidad',
          detalle: version(TipoDocumentoLegal.privacidad),
          icono: Icons.lock_rounded,
          onTap: () => context.push(Rutas.privacidad),
        ),
      ],
    );
  }
}

/// «Mi perfil de estudio» con «Editar», que abre los tres pasos con el
/// perfil guardado, y sus datos en una tarjeta.
class _PerfilDeEstudio extends ConsumerWidget {
  const _PerfilDeEstudio();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfil = ref.watch(perfilProvider);
    final opciones = ref.watch(opcionesPerfilProvider);
    final guardado = perfil.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: TituloSeccion('Mi perfil de estudio')),
            if (guardado != null)
              TextButton(
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.padded,
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
        const SizedBox(height: TemaSuperaPaes.espacio8),
        if (perfil.hasError || opciones.hasError)
          Aviso(
            tono: TonoAviso.error,
            texto: switch (perfil.error ?? opciones.error) {
              final ErrorApi error => error.mensaje,
              _ => 'No se pudo cargar tu perfil.',
            },
          )
        else if (guardado == null || !opciones.hasValue)
          const EsqueletoTarjeta(lineas: 4)
        else
          Tarjeta(
            child: _DatosDelPerfil(
              perfil: guardado,
              opciones: opciones.requireValue,
            ),
          ),
      ],
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
    final pruebas = [for (final id in perfil.pruebas) ?opciones.prueba(id)];
    final areas = [
      for (final id in perfil.areasCarrera) ?opciones.area(id)?.nombre,
    ];
    final electivo = perfil.electivoId == null
        ? null
        : opciones.electivo(perfil.electivoId!);
    final reforzar = perfil.pruebaReforzarId == null
        ? null
        : opciones.prueba(perfil.pruebaReforzarId!)?.nombreCorto;
    const separador = Padding(
      padding: EdgeInsets.symmetric(vertical: TemaSuperaPaes.espacio12),
      child: Divider(height: 1),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (curso != null) ...[
          FilaDato(
            etiqueta: 'Curso',
            valor: '${curso.nombre} (egreso ${perfil.anioEgreso})',
          ),
          separador,
        ],
        Text(
          'Pruebas',
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        const SizedBox(height: TemaSuperaPaes.espacio8),
        if (pruebas.isEmpty)
          const Text('Sin elegir', style: TemaSuperaPaes.pequenoFuerte)
        else
          Wrap(
            spacing: TemaSuperaPaes.espacio12,
            runSpacing: TemaSuperaPaes.espacio8,
            children: [
              for (final prueba in pruebas)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SelloPrueba(Prueba.deCodigo(prueba.codigo), tamano: 28),
                    const SizedBox(width: TemaSuperaPaes.espacio8),
                    Text(prueba.nombreCorto, style: TemaSuperaPaes.cuerpo),
                  ],
                ),
            ],
          ),
        separador,
        if (electivo != null) ...[
          FilaDato(etiqueta: 'Electivo de Ciencias', valor: electivo),
          const SizedBox(height: TemaSuperaPaes.espacio12),
        ],
        FilaDato(etiqueta: 'Prueba a reforzar', valor: reforzar ?? 'Ninguna'),
        const SizedBox(height: TemaSuperaPaes.espacio12),
        FilaDato(
          etiqueta: 'Áreas de carrera',
          valor: areas.isEmpty ? 'Ninguna' : areas.join(', '),
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
    // Botón Contorno a lo ancho, como en la maqueta A37.
    return OutlinedButton.icon(
      onPressed: _cerrando ? null : _cerrar,
      icon: const Icon(Icons.logout_rounded, size: 20),
      label: const Text('Cerrar sesión'),
    );
  }
}
