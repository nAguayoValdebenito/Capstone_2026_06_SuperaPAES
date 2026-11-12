import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';
import 'package:supera_paes/presentacion/puntajes/formulario_puntaje.dart';
import 'package:supera_paes/presentacion/puntajes/hojas_permiso.dart';

/// A41 · Mis puntajes PAES (HU-41.2, RF-A17, RN-16, CU-14a): el permiso
/// opcional para usar los puntajes y, con él, la carga de prueba, año y
/// puntaje, y los puntajes cargados. Sin el permiso no se carga nada; al
/// retirarlo, los puntajes se borran.
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
        const EnlaceVolver(
          texto: 'Mis datos y privacidad',
          destino: Rutas.misDatos,
        ),
        const Encabezado(
          titulo: 'Mis puntajes PAES',
          bajada:
              'Opcional. Sirve para mejorar las métricas de todos, sin '
              'identificarte.',
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
            if (datos.permiso.otorgado) ...[
              const TituloSeccion('Cargar un puntaje'),
              FormularioPuntaje(
                pruebas: nombres.pruebas,
                pruebaInicial:
                    perfil?.pruebaReforzarId ??
                    perfil?.pruebas.firstOrNull ??
                    nombres.pruebas.first.id,
              ),
              if (datos.puntajes.isNotEmpty)
                _PuntajesCargados(puntajes: datos.puntajes, nombres: nombres),
            ] else
              const Aviso(
                tono: TonoAviso.neutro,
                icono: Icons.lock_rounded,
                texto:
                    'Sin el permiso no guardamos puntajes. Puedes activarlo '
                    'cuando quieras.',
              ),
          ],
          _ => const [GrupoEsqueleto(child: EsqueletoTarjeta(lineas: 4))],
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(
                  child: Text(
                    'Autorizo a Supera PAES a guardar los puntajes PAES que '
                    'declaro y a usarlos solo en métricas agregadas que no me '
                    'identifican. Puedo retirar este permiso en Mis datos y '
                    'mis puntajes se eliminarán.',
                    style: TemaSuperaPaes.pequeno,
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

/// Los puntajes cargados en una tarjeta: «M1 · admisión 2026 · 742
/// puntos», cada uno con su botón para borrarlo.
class _PuntajesCargados extends StatelessWidget {
  const _PuntajesCargados({required this.puntajes, required this.nombres});

  final List<PuntajePaes> puntajes;
  final OpcionesPerfil nombres;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        children: [
          for (final (i, puntaje) in puntajes.indexed) ...[
            if (i > 0) const Divider(height: 16),
            _FilaPuntaje(
              puntaje: puntaje,
              nombre: nombres.prueba(puntaje.pruebaId)?.nombreCorto ?? 'Prueba',
            ),
          ],
        ],
      ),
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
    final admision = 'admisión ${puntaje.anioAdmision}';
    return Row(
      children: [
        const ExcludeSemantics(
          child: Icon(
            Icons.check_circle_rounded,
            size: 20,
            color: TemaSuperaPaes.exito,
          ),
        ),
        const SizedBox(width: TemaSuperaPaes.espacio8),
        Expanded(
          child: Text(
            '$nombre · $admision · ${puntaje.puntaje} puntos',
            style: TemaSuperaPaes.tabular(TemaSuperaPaes.pequeno),
          ),
        ),
        IconButton(
          tooltip: 'Borrar el puntaje de $nombre, $admision',
          icon: const Icon(
            Icons.delete_outline_rounded,
            size: 20,
            color: TemaSuperaPaes.textoSecundario,
          ),
          onPressed: () => _borrar(context, ref),
        ),
      ],
    );
  }
}
