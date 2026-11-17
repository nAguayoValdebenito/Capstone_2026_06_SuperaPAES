import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/dominio/entidades/solicitud_datos.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/fechas.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_solicitudes.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';

/// A40 · Solicitudes sobre mis datos (HU-09, CU-14 3.b, RF-A21, RNF-09):
/// pedir uno de los derechos de la Ley 21.719 con un detalle opcional y ver
/// el estado, la fecha límite y la respuesta de cada solicitud. La
/// confirmación solo aparece cuando la API guardó la solicitud.
class PantallaSolicitudesDatos extends ConsumerWidget {
  const PantallaSolicitudesDatos({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tipos = ref.watch(tiposDerechoProvider);
    final solicitudes = ref.watch(solicitudesDatosProvider);
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(
          texto: 'Mis datos y privacidad',
          destino: Rutas.misDatos,
        ),
        const Encabezado(
          titulo: 'Solicitudes sobre mis datos',
          bajada:
              'Tienes derecho a pedir esto sobre tus datos personales '
              '(Ley 21.719). Cada solicitud muestra la fecha en que te '
              'responderemos.',
        ),
        const TituloSeccion('Nueva solicitud'),
        switch (tipos) {
          AsyncData(value: final lista) => FormularioSolicitud(tipos: lista),
          AsyncError(:final error) => ErrorConReintento(
            error: error,
            mensaje: 'No se pudieron cargar los tipos de solicitud.',
            alReintentar: () => ref.invalidate(tiposDerechoProvider),
          ),
          _ => const GrupoEsqueleto(child: EsqueletoTarjeta(lineas: 4)),
        },
        const TituloSeccion('Mis solicitudes'),
        ...switch (solicitudes) {
          AsyncData(value: final lista) when lista.isEmpty => [
            Text(
              'Aún no has enviado solicitudes.',
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
          ],
          AsyncData(value: final lista) => [
            for (final solicitud in lista) TarjetaSolicitud(solicitud),
          ],
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudieron cargar tus solicitudes.',
              alReintentar: () => ref.invalidate(solicitudesDatosProvider),
            ),
          ],
          _ => const [GrupoEsqueleto(child: EsqueletoTarjeta(lineas: 3))],
        },
      ],
    );
  }
}

/// Los tipos con su explicación, el detalle opcional y «Enviar solicitud».
class FormularioSolicitud extends ConsumerStatefulWidget {
  const FormularioSolicitud({required this.tipos, super.key});

  final List<TipoDerecho> tipos;

  @override
  ConsumerState<FormularioSolicitud> createState() =>
      _FormularioSolicitudState();
}

class _FormularioSolicitudState extends ConsumerState<FormularioSolicitud> {
  final _detalle = TextEditingController();
  String? _tipo;
  bool _enviando = false;
  String? _error;
  SolicitudDatos? _recibida;

  @override
  void dispose() {
    _detalle.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    final tipo = _tipo;
    if (tipo == null || _enviando) return;
    setState(() {
      _enviando = true;
      _error = null;
      _recibida = null;
    });
    final detalle = _detalle.text.trim();
    try {
      final recibida = await ref
          .read(repositorioMisDatosProvider)
          .crearSolicitud(tipo, detalle.isEmpty ? null : detalle);
      ref.invalidate(solicitudesDatosProvider);
      if (!mounted) return;
      _detalle.clear();
      setState(() {
        _tipo = null;
        _recibida = recibida;
      });
    } on ErrorApi catch (error) {
      if (mounted) setState(() => _error = error.mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final recibida = _recibida;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final tipo in widget.tipos) ...[
          OpcionRadio(
            texto: tipo.nombre,
            detalle: tipo.descripcion,
            seleccionada: _tipo == tipo.codigo,
            onTap: () {
              if (!_enviando) setState(() => _tipo = tipo.codigo);
            },
          ),
          const SizedBox(height: TemaSuperaPaes.espacio8),
        ],
        const SizedBox(height: TemaSuperaPaes.espacio8),
        CampoConEtiqueta(
          etiqueta: 'Detalle (opcional)',
          ayuda: 'Cuéntanos qué necesitas, si quieres.',
          child: TextField(
            key: const Key('detalle-solicitud'),
            controller: _detalle,
            enabled: !_enviando,
            minLines: 3,
            maxLines: 6,
            maxLength: largoMaximoDetalle,
            textCapitalization: TextCapitalization.sentences,
            style: TemaSuperaPaes.cuerpo,
          ),
        ),
        const SizedBox(height: TemaSuperaPaes.espacio12),
        if (recibida != null) ...[
          Aviso(
            tono: TonoAviso.exito,
            texto:
                'Recibimos tu solicitud. Te responderemos a más tardar el '
                '${fechaConAnio(recibida.venceEn)}.',
          ),
          const SizedBox(height: TemaSuperaPaes.espacio12),
        ],
        BotonPrincipal(
          texto: 'Enviar solicitud',
          estado: _enviando
              ? EstadoBoton.cargando
              : _error == null
              ? EstadoBoton.normal
              : EstadoBoton.error,
          error: _error,
          onPressed: _tipo == null ? null : _enviar,
        ),
      ],
    );
  }
}

/// Una solicitud: tipo y estado, fechas, el detalle y la respuesta.
class TarjetaSolicitud extends StatelessWidget {
  const TarjetaSolicitud(this.solicitud, {super.key});

  final SolicitudDatos solicitud;

  @override
  Widget build(BuildContext context) {
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final negrita = TemaSuperaPaes.pequeno.copyWith(
      fontWeight: FontWeight.w600,
    );
    final respuesta = solicitud.respuesta;
    final respondidoEn = solicitud.respondidoEn;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: TemaSuperaPaes.espacio8,
            runSpacing: TemaSuperaPaes.espacio4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(solicitud.tipo, style: TemaSuperaPaes.h2),
              Text(
                solicitud.nombreEstado,
                style: negrita.copyWith(
                  color: switch (solicitud.estado) {
                    EstadoSolicitud.pendiente => TemaSuperaPaes.primarioOscuro,
                    EstadoSolicitud.respondida => TemaSuperaPaes.exito,
                    EstadoSolicitud.rechazada => TemaSuperaPaes.error,
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: TemaSuperaPaes.espacio4),
          Text(
            'Enviada el ${fechaConAnio(solicitud.solicitadoEn)} · Responder '
            'antes del ${fechaConAnio(solicitud.venceEn)}',
            style: secundario,
          ),
          if (solicitud.detalle case final detalle?) ...[
            const SizedBox(height: TemaSuperaPaes.espacio8),
            Text(detalle, style: TemaSuperaPaes.pequeno),
          ],
          if (respuesta != null) ...[
            const SizedBox(height: TemaSuperaPaes.espacio12),
            Text(
              respondidoEn == null
                  ? 'Respuesta'
                  : 'Respuesta del ${fechaConAnio(respondidoEn)}',
              style: negrita,
            ),
            const SizedBox(height: TemaSuperaPaes.espacio4),
            Text(respuesta, style: TemaSuperaPaes.pequeno),
          ],
        ],
      ),
    );
  }
}
