import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';

/// Borrar mi cuenta (A42 y A42b; HU-08.2, CU-14 pasos 4 a 6 y alternativos
/// 4.a y 5.a, RF-A18), desde Mis datos: explica qué se borra y qué queda
/// seudonimizado, ofrece descargar los datos antes y pide confirmar. Con una
/// suscripción activa o en mora (A42b) avisa que la tienda seguirá cobrando,
/// ofrece abrir su gestión de suscripciones y pide una casilla más (RN-34).
/// Al borrar, la sesión se cierra y la app vuelve al ingreso.
class PantallaBorrarCuenta extends ConsumerStatefulWidget {
  const PantallaBorrarCuenta({super.key});

  @override
  ConsumerState<PantallaBorrarCuenta> createState() =>
      _PantallaBorrarCuentaState();
}

class _PantallaBorrarCuentaState extends ConsumerState<PantallaBorrarCuenta>
    with DescargaDeMisDatos {
  bool _entiendoPerdida = false;
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
    final suscripcion = ref.watch(suscripcionVigenteProvider);
    // Sin saber si hay una suscripción vigente, no se puede avisar (RN-34).
    final revisada = suscripcion is AsyncData<SuscripcionVigente?>;
    final vigente = revisada ? suscripcion.value : null;
    final confirmada = _entiendoPerdida && (vigente == null || _entiendoTienda);
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(
          texto: 'Mis datos y privacidad',
          destino: Rutas.misDatos,
        ),
        const _IconoBorrar(),
        const Encabezado(
          titulo: '¿Borrar tu cuenta?',
          bajada:
              'Se eliminan tu nombre, correo, perfil y puntajes. Tus '
              'evaluaciones y respuestas quedan seudonimizadas, sin tu nombre '
              'ni tu correo, solo para estadísticas. No se puede deshacer.',
        ),
        ...switch (suscripcion) {
          AsyncData(value: final datos?) => _suscripcion(datos),
          AsyncData() => const <Widget>[],
          AsyncError(error: final fallo) => [
            ErrorConReintento(
              error: fallo,
              mensaje: 'No se pudo revisar si tienes una suscripción.',
              alReintentar: () => ref.invalidate(suscripcionVigenteProvider),
            ),
          ],
          _ => const [Center(child: CircularProgressIndicator())],
        },
        Semantics(
          button: true,
          child: GestureDetector(
            onTap: descargar,
            child: Aviso(
              tono: TonoAviso.info,
              textoRico: descargando
                  ? const TextSpan(text: 'Preparando tu archivo…')
                  : const TextSpan(
                      children: [
                        TextSpan(text: 'Antes de borrar, puedes '),
                        TextSpan(
                          text: 'descargar tus datos',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        TextSpan(text: '.'),
                      ],
                    ),
            ),
          ),
        ),
        if (vigente != null)
          _Casilla(
            texto: 'Entiendo que debo cancelarla en la tienda',
            marcada: _entiendoTienda,
            onChanged: (valor) => setState(() => _entiendoTienda = valor),
          ),
        _Casilla(
          texto: 'Entiendo que perderé mi historial y mi progreso.',
          marcada: _entiendoPerdida,
          onChanged: (valor) => setState(() => _entiendoPerdida = valor),
        ),
      ],
      pie: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PieConError(
            error: error,
            boton: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: TemaSuperaPaes.error,
              ),
              onPressed: revisada && confirmada && !_borrando ? _borrar : null,
              child: _borrando
                  ? const CargandoEnBoton()
                  : const Text('Borrar mi cuenta'),
            ),
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

  /// A42b: el aviso de la tienda y el botón para cancelarla allá (RN-34).
  List<Widget> _suscripcion(SuscripcionVigente datos) {
    final tienda = datos.tienda.nombre;
    return [
      Aviso(
        tono: TonoAviso.aviso,
        textoRico: TextSpan(
          children: [
            const TextSpan(text: 'Tienes una suscripción '),
            TextSpan(
              text: datos.enMora ? 'en mora' : 'activa',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            TextSpan(
              text:
                  ' (${datos.plan}, ${datos.periodicidad}, $tienda). $tienda '
                  'seguirá cobrando hasta que la canceles en la tienda: la '
                  'app no puede cancelarla.',
            ),
          ],
        ),
      ),
      OutlinedButton(
        onPressed: () => _abrirTienda(datos.tienda),
        child: Text('Abrir mis suscripciones en $tienda'),
      ),
    ];
  }
}

/// El basurero en un círculo rojo suave (A42).
class _IconoBorrar extends StatelessWidget {
  const _IconoBorrar();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: 48,
        height: 48,
        decoration: const BoxDecoration(
          color: TemaSuperaPaes.errorSuave,
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.delete_outline,
          size: 24,
          color: TemaSuperaPaes.error,
        ),
      ),
    );
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
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
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
