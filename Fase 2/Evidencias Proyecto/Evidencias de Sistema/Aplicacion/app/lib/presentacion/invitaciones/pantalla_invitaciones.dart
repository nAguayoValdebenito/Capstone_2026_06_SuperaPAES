import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/resumen_invitaciones.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';
import 'package:supera_paes/presentacion/invitaciones/estado_invitaciones.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';

/// Invitar (A38; HU-46, HU-47, CU-11 pasos 1 a 3, RF-A12, RN-03, RN-33),
/// desde Perfil: el código propio y el link a la página de invitación, para
/// copiarlos o compartirlos; cómo funciona; y lo que lleva: cuántos se
/// registraron y verificaron su correo, las preguntas ganadas y las
/// invitaciones premiadas del mes con su tope.
class PantallaInvitaciones extends ConsumerWidget {
  const PantallaInvitaciones({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invitaciones = ref.watch(invitacionesProvider);
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return PantallaFormulario(
      separacion: 14,
      pie: switch (invitaciones) {
        AsyncData(:final value) => FilledButton.icon(
          onPressed: () =>
              ref.read(compartirTextoProvider)(mensajeDeInvitacion(value)),
          icon: const Icon(Icons.ios_share_rounded, size: 20),
          label: const Text('Compartir invitación'),
        ),
        _ => null,
      },
      hijos: [
        const EnlaceVolver(texto: 'Perfil', destino: Rutas.perfil),
        const Encabezado(
          titulo: 'Invita y gana preguntas',
          bajada:
              'Ganas 5 preguntas extra por cada persona que se registre con '
              'tu invitación y verifique su correo.',
        ),
        ...switch (invitaciones) {
          AsyncData(:final value) => [
            _TarjetaCodigo(invitaciones: value),
            const TituloSeccion('Cómo funciona'),
            const _Paso(
              icono: Icons.ios_share_rounded,
              texto: 'Comparte tu código o tu link.',
            ),
            const _Paso(
              icono: Icons.person_add_alt_1_rounded,
              texto: 'La otra persona se registra con él.',
            ),
            const _Paso(
              icono: Icons.mark_email_read_rounded,
              texto: 'Cuando verifica su correo, ganas 5 preguntas extra.',
            ),
            const TituloSeccion('Lo que llevas'),
            if (value.registrados == 0)
              const _SinInvitados()
            else ...[
              _LoQueLlevas(invitaciones: value),
              if (value.premiadasMes >= value.topeMes) const _AvisoTope(),
            ],
            Text(
              'Las preguntas extra se usan después del cupo del día, se '
              'acumulan y no vencen. Cada correo cuenta una sola vez.',
              style: secundario,
            ),
          ],
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar tu invitación.',
              alReintentar: () => ref.invalidate(invitacionesProvider),
            ),
          ],
          _ => const [
            GrupoEsqueleto(
              child: Column(
                children: [
                  EsqueletoTarjeta(lineas: 3),
                  SizedBox(height: TemaSuperaPaes.espacio16),
                  EsqueletoTarjeta(lineas: 4),
                ],
              ),
            ),
          ],
        },
      ],
    );
  }
}

/// «K7 P2 QX»: el código en pares, para dictarlo y copiarlo sin errores.
String codigoEnPares(String codigo) => [
  for (var i = 0; i < codigo.length; i += 2)
    codigo.substring(i, i + 2 > codigo.length ? codigo.length : i + 2),
].join('  ');

/// El link sin «https://», como en A38.
String linkSinEsquema(String link) =>
    link.replaceFirst(RegExp('^https?://'), '');

/// «Tu código» en grande, «Copiar código» y «Copiar link», y el link (A38).
class _TarjetaCodigo extends StatelessWidget {
  const _TarjetaCodigo({required this.invitaciones});

  final ResumenInvitaciones invitaciones;

  Future<void> _copiar(BuildContext context, String texto, String que) async {
    await Clipboard.setData(ClipboardData(text: texto));
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('$que copiado.')));
  }

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tu código',
            style: TemaSuperaPaes.etiqueta.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          Semantics(
            label: 'Tu código: ${invitaciones.codigo.split('').join(' ')}',
            excludeSemantics: true,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                codigoEnPares(invitaciones.codigo),
                style: TemaSuperaPaes.display.copyWith(
                  color: TemaSuperaPaes.primarioOscuro,
                  letterSpacing: 1,
                ),
              ),
            ),
          ),
          const SizedBox(height: TemaSuperaPaes.espacio4),
          Wrap(
            spacing: TemaSuperaPaes.espacio8,
            children: [
              TextButton.icon(
                onPressed: () =>
                    _copiar(context, invitaciones.codigo, 'Código'),
                icon: const Icon(Icons.copy_rounded, size: 18),
                label: const Text('Copiar código'),
              ),
              TextButton.icon(
                onPressed: () => _copiar(context, invitaciones.link, 'Link'),
                icon: const Icon(Icons.copy_rounded, size: 18),
                label: const Text('Copiar link'),
              ),
            ],
          ),
          Text(
            linkSinEsquema(invitaciones.link),
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ),
    );
  }
}

/// Un paso de «Cómo funciona», con su ícono.
class _Paso extends StatelessWidget {
  const _Paso({required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Icon(icono, size: 22, color: TemaSuperaPaes.primario),
        ),
        const SizedBox(width: TemaSuperaPaes.espacio12),
        Expanded(child: Text(texto, style: TemaSuperaPaes.cuerpo)),
      ],
    );
  }
}

/// Los contadores y la barra de las invitaciones premiadas del mes.
class _LoQueLlevas extends StatelessWidget {
  const _LoQueLlevas({required this.invitaciones});

  final ResumenInvitaciones invitaciones;

  @override
  Widget build(BuildContext context) {
    final premiadas = '${invitaciones.premiadasMes} de ${invitaciones.topeMes}';
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilaDato(
            etiqueta: 'Registrados con tu código',
            valor: '${invitaciones.registrados}',
          ),
          const SizedBox(height: TemaSuperaPaes.espacio12),
          FilaDato(
            etiqueta: 'Con el correo verificado',
            valor: '${invitaciones.verificados}',
          ),
          const SizedBox(height: TemaSuperaPaes.espacio12),
          FilaDato(
            etiqueta: 'Preguntas ganadas',
            valor: '${invitaciones.preguntasGanadas}',
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: TemaSuperaPaes.espacio12),
            child: Divider(height: 1),
          ),
          Text(
            'Invitaciones premiadas este mes',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          const SizedBox(height: TemaSuperaPaes.espacio8),
          BarraAnimada(
            valor: invitaciones.topeMes == 0
                ? 0
                : invitaciones.premiadasMes / invitaciones.topeMes,
            etiquetaSemantica: 'Invitaciones premiadas este mes: $premiadas',
          ),
          const SizedBox(height: TemaSuperaPaes.espacio8),
          ExcludeSemantics(
            child: Text(
              premiadas,
              style: TemaSuperaPaes.tabular(TemaSuperaPaes.pequenoFuerte),
            ),
          ),
        ],
      ),
    );
  }
}

/// Todavía nadie se registró con su código (A38, sin invitados).
class _SinInvitados extends StatelessWidget {
  const _SinInvitados();

  @override
  Widget build(BuildContext context) {
    return const Tarjeta(
      child: Row(
        children: [
          Trazo(ancho: 56, color: TemaSuperaPaes.bordeInput),
          SizedBox(width: TemaSuperaPaes.espacio16),
          Expanded(
            child: Text(
              'Aún no invitas a nadie. Cada amigo que verifique su correo te '
              'da 5 preguntas extra.',
              style: TemaSuperaPaes.cuerpo,
            ),
          ),
        ],
      ),
    );
  }
}

/// Las premiadas del mes llegaron al tope (RN-03).
class _AvisoTope extends StatelessWidget {
  const _AvisoTope();

  @override
  Widget build(BuildContext context) => const Aviso(
    tono: TonoAviso.primario,
    icono: Icons.event_available_rounded,
    texto:
        'Llegaste al tope de este mes. Tus invitados siguen contando desde '
        'el mes siguiente.',
  );
}
