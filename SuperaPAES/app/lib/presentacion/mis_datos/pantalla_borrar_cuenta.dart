import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';

/// Borrar mi cuenta (A42 y A42b; HU-08.2, CU-14 pasos 4 a 6 y alternativos
/// 4.a y 5.a, RF-A18), desde Mis datos: explica qué se borra y qué queda
/// seudonimizado y ofrece descargar los datos antes; «Borrar mi cuenta»
/// confirma. Con una suscripción activa o en mora (A42b) avisa que la tienda
/// seguirá cobrando, ofrece abrir su gestión de suscripciones y pide marcar
/// que debe cancelarla allá (RN-34). Al borrar, la sesión se cierra y la app
/// vuelve al ingreso.
class PantallaBorrarCuenta extends ConsumerStatefulWidget {
  const PantallaBorrarCuenta({super.key});

  @override
  ConsumerState<PantallaBorrarCuenta> createState() =>
      _PantallaBorrarCuentaState();
}

class _PantallaBorrarCuentaState extends ConsumerState<PantallaBorrarCuenta>
    with DescargaDeMisDatos {
  bool _entiendoTienda = false;
  bool _borrando = false;

  Future<void> _abrirTienda(Tienda tienda) async {
    bool abierta;
    try {
      abierta = await ref.read(abrirEnlaceProvider)(
        gestionDeSuscripciones(tienda),
      );
    } on Exception {
      abierta = false;
    }
    if (!abierta && mounted) {
      setState(
        () => error =
            'No se pudo abrir ${tienda.nombre}. Cancela la suscripción desde '
            'la app de la tienda.',
      );
    }
  }

  /// CU-14 paso 6: la API borra la cuenta y cierra la sesión; aquí se olvida
  /// en el teléfono, y el enrutador lleva al ingreso.
  Future<void> _borrar() async {
    if (_borrando) return;
    final repositorio = ref.read(repositorioMisDatosProvider);
    final sesion = ref.read(sesionProvider.notifier);
    final mensajero = ScaffoldMessenger.of(context);
    setState(() {
      _borrando = true;
      error = null;
    });
    try {
      await repositorio.borrarCuenta();
    } on ErrorApi catch (fallo) {
      if (mounted) {
        setState(() {
          _borrando = false;
          error = fallo.mensaje;
        });
      }
      return;
    }
    mensajero.showSnackBar(
      const SnackBar(content: Text('Tu cuenta se borró.')),
    );
    await sesion.olvidarCuentaBorrada();
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(estadoDeLaCuentaProvider);
    // Sin saber si hay una suscripción vigente, no se puede avisar (RN-34).
    final revisada = estado is AsyncData<EstadoDeLaCuenta>;
    final vigente = revisada ? estado.value.suscripcionVigente : null;
    final confirmada = vigente == null || _entiendoTienda;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(
          texto: 'Mis datos y privacidad',
          destino: Rutas.misDatos,
        ),
        const Encabezado(
          titulo: 'Borrar mi cuenta',
          bajada:
              'Se eliminarán tu nombre y tu correo, y tus evaluaciones '
              'quedarán sin datos que te identifiquen. Esta acción no se '
              'puede deshacer. Antes, puedes descargar tus datos.',
        ),
        OutlinedButton.icon(
          onPressed: descargando ? null : descargar,
          icon: descargando
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.download_rounded, size: 20),
          label: Text(
            descargando
                ? 'Preparando tu archivo…'
                : 'Descargar mis datos primero',
          ),
        ),
        ...switch (estado) {
          AsyncData() => [if (vigente != null) ..._suscripcion(vigente)],
          AsyncError(error: final fallo) => [
            ErrorConReintento(
              error: fallo,
              mensaje: 'No se pudo revisar si tienes una suscripción.',
              alReintentar: () => ref.invalidate(estadoDeLaCuentaProvider),
            ),
          ],
          _ => const [GrupoEsqueleto(child: EsqueletoTarjeta())],
        },
      ],
      pie: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BotonPrincipal(
            texto: 'Borrar mi cuenta',
            color: TemaSuperaPaes.error,
            estado: _borrando
                ? EstadoBoton.cargando
                : error == null
                ? EstadoBoton.normal
                : EstadoBoton.error,
            error: error,
            onPressed: revisada && confirmada ? _borrar : null,
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _borrando
                ? null
                : () => context.canPop()
                      ? context.pop()
                      : context.go(Rutas.misDatos),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );
  }

  /// A42b: el aviso de la tienda, el botón para cancelarla allá y la casilla
  /// que confirma que lo entendió (RN-34).
  List<Widget> _suscripcion(SuscripcionVigente datos) {
    return [
      Aviso(
        tono: TonoAviso.neutro,
        icono: Icons.credit_card_rounded,
        texto:
            'Tienes una suscripción ${datos.enMora ? 'en mora' : 'activa'}. '
            'Si borras tu cuenta, la tienda seguirá cobrando hasta que la '
            'canceles en Google Play o en la App Store.',
      ),
      OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: TemaSuperaPaes.primario,
          textStyle: TemaSuperaPaes.pequenoFuerte,
        ),
        onPressed: () => _abrirTienda(datos.tienda),
        icon: const Icon(Icons.open_in_new_rounded, size: 18),
        label: const Text('Abrir suscripciones de la tienda'),
      ),
      _Casilla(
        texto: 'Entiendo que debo cancelarla en la tienda',
        marcada: _entiendoTienda,
        onChanged: (valor) => setState(() => _entiendoTienda = valor),
      ),
    ];
  }
}

/// Casilla con su texto, que también se marca al tocar el texto.
class _Casilla extends StatelessWidget {
  const _Casilla({
    required this.texto,
    required this.marcada,
    required this.onChanged,
  });

  final String texto;
  final bool marcada;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox.square(
            dimension: 22,
            child: Checkbox(
              value: marcada,
              onChanged: (valor) => onChanged(valor ?? false),
              materialTapTargetSize: MaterialTapTargetSize.padded,
              visualDensity: VisualDensity.compact,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: GestureDetector(
              onTap: () => onChanged(!marcada),
              child: Text(texto, style: TemaSuperaPaes.pequeno),
            ),
          ),
        ],
      ),
    );
  }
}
