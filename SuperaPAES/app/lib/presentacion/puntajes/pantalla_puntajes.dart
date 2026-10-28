import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';
import 'package:supera_paes/presentacion/puntajes/formulario_puntaje.dart';
import 'package:supera_paes/presentacion/puntajes/hojas_permiso.dart';

/// A41 · Mis puntajes PAES (HU-41.2, RF-A17, RN-16, CU-14a): el permiso
/// opcional para usar los puntajes, la carga de prueba, año y puntaje, y los
/// puntajes cargados. Sin el permiso no se carga nada; al retirarlo, los
/// puntajes se borran.
class PantallaPuntajes extends ConsumerWidget {
  const PantallaPuntajes({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final puntajes = ref.watch(puntajesProvider);
    final nombres = ref.watch(opcionesPerfilProvider).value;
    final perfil = ref.watch(perfilProvider).value;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(texto: 'Mis datos', destino: Rutas.misDatos),
        const Encabezado(
          titulo: 'Mis puntajes PAES',
          bajada:
              'Si ya rendiste la PAES, carga tu puntaje real para compararlo '
              'con tus ensayos.',
        ),
        ...switch ((puntajes, nombres)) {
          (AsyncError(:final error), _) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudieron cargar tus puntajes.',
              alReintentar: () => ref.invalidate(puntajesProvider),
            ),
          ],
          (AsyncData(value: final PuntajesPaes datos), final nombres?) => [
            _TarjetaPermiso(datos: datos),
            if (datos.permiso.otorgado)
              FormularioPuntaje(
                pruebas: nombres.pruebas,
                pruebaInicial:
                    perfil?.pruebaReforzarId ??
                    perfil?.pruebas.firstOrNull ??
                    nombres.pruebas.first.id,
              )
            else
              const Aviso(
                tono: TonoAviso.info,
                texto: 'Para cargar tus puntajes, primero activa el permiso.',
              ),
            _PuntajesCargados(puntajes: datos.puntajes, nombres: nombres),
          ],
          _ => [const Center(child: CircularProgressIndicator())],
        },
      ],
    );
  }
}

/// «Permiso para usar mis puntajes» con su interruptor. Activarlo muestra el
/// permiso completo; desactivarlo avisa que se borran los puntajes.
class _TarjetaPermiso extends ConsumerStatefulWidget {
  const _TarjetaPermiso({required this.datos});

  final PuntajesPaes datos;

  @override
  ConsumerState<_TarjetaPermiso> createState() => _TarjetaPermisoState();
}

class _TarjetaPermisoState extends ConsumerState<_TarjetaPermiso> {
  bool _ocupado = false;
  String? _error;

  Future<void> _cambiar(bool activar) async {
    final permiso = widget.datos.permiso;
    final estado = ref.read(puntajesProvider.notifier);
    final confirmo = await confirmarEnHoja(
      context,
      activar
          ? HojaDarPermiso(permiso: permiso)
          : HojaRetirarPermiso(cargados: widget.datos.puntajes.length),
    );
    if (!confirmo || !mounted) return;
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      await (activar
          ? estado.otorgarPermiso(permiso.documentoId)
          : estado.retirarPermiso());
    } on ErrorApi catch (error) {
      if (mounted) setState(() => _error = error.mensaje);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MergeSemantics(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Permiso para usar mis puntajes',
                        style: TemaSuperaPaes.cuerpoFuerte,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Se usan solo en métricas agregadas. Puedes retirarlo '
                        'cuando quieras; al retirarlo, borramos tus puntajes.',
                        style: TemaSuperaPaes.pequeno.copyWith(
                          color: TemaSuperaPaes.textoSecundario,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Switch(
                  value: widget.datos.permiso.otorgado,
                  onChanged: _ocupado ? null : _cambiar,
                ),
              ],
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Aviso(tono: TonoAviso.error, texto: error),
          ],
        ],
      ),
    );
  }
}

/// «Puntajes cargados»: prueba, año y puntaje, cada uno con «Borrar».
class _PuntajesCargados extends ConsumerWidget {
  const _PuntajesCargados({required this.puntajes, required this.nombres});

  final List<PuntajePaes> puntajes;
  final OpcionesPerfil nombres;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: const Text('Puntajes cargados', style: TemaSuperaPaes.h2),
        ),
        const SizedBox(height: 10),
        if (puntajes.isEmpty)
          const Text('Aún no cargas puntajes.', style: TemaSuperaPaes.pequeno)
        else
          Tarjeta(
            child: Column(
              children: [
                for (final (i, puntaje) in puntajes.indexed) ...[
                  if (i > 0) const Divider(height: 16),
                  _FilaPuntaje(
                    puntaje: puntaje,
                    nombre:
                        nombres.prueba(puntaje.pruebaId)?.nombreEnInicio ??
                        'Prueba',
                  ),
                ],
              ],
            ),
          ),
        const SizedBox(height: 14),
        Text('Los puntajes son declarados por ti.', style: secundario),
      ],
    );
  }
}

class _FilaPuntaje extends ConsumerWidget {
  const _FilaPuntaje({required this.puntaje, required this.nombre});

  final PuntajePaes puntaje;
  final String nombre;

  Future<void> _borrar(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(puntajesProvider.notifier).borrar(puntaje.id);
    } on ErrorApi catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.mensaje)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final admision = 'Admisión ${puntaje.anioAdmision}';
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(nombre, style: TemaSuperaPaes.cuerpoFuerte),
              Text(
                admision,
                style: TemaSuperaPaes.pequeno.copyWith(
                  color: TemaSuperaPaes.textoSecundario,
                ),
              ),
            ],
          ),
        ),
        Text('${puntaje.puntaje}', style: TemaSuperaPaes.h2),
        IconButton(
          tooltip: 'Borrar el puntaje de $nombre, $admision',
          icon: const Icon(Icons.delete_outline),
          onPressed: () => _borrar(context, ref),
        ),
      ],
    );
  }
}
