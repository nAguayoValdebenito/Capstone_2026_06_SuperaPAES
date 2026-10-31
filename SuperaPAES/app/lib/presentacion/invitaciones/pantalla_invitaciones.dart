import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/resumen_invitaciones.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/invitaciones/estado_invitaciones.dart';

/// Invitar (A38; HU-46, HU-47, CU-11 pasos 1 a 3, RF-A12, RN-03, RN-33),
/// desde Perfil: el link a la página de invitación y el código propio, para
/// copiarlos o compartirlos; cuántos se registraron y verificaron su correo,
/// las preguntas ganadas, el saldo de preguntas extra y las invitaciones
/// premiadas del mes con su tope.
class PantallaInvitaciones extends ConsumerWidget {
  const PantallaInvitaciones({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invitaciones = ref.watch(invitacionesProvider);
    return PantallaFormulario(
      separacion: 14,
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
            _TarjetaLinkYCodigo(invitaciones: value),
            FilledButton(
              onPressed: () =>
                  ref.read(compartirTextoProvider)(mensajeDeInvitacion(value)),
              child: const Text('Compartir invitación'),
            ),
            Row(
              children: [
                _Contador(valor: value.registrados, texto: 'registrados'),
                const SizedBox(width: 12),
                _Contador(valor: value.verificados, texto: 'verificados'),
                const SizedBox(width: 12),
                _Contador(
                  valor: value.preguntasGanadas,
                  texto: 'preguntas ganadas',
                ),
              ],
            ),
            Tarjeta(
              child: Column(
                children: [
                  FilaDato(
                    etiqueta: 'Saldo de preguntas extra',
                    valor: '${value.saldoExtra}',
                  ),
                  const SizedBox(height: 10),
                  FilaDato(
                    etiqueta: 'Invitaciones premiadas este mes',
                    valor: '${value.premiadasMes} de ${value.topeMes}',
                  ),
                ],
              ),
            ),
            Text(
              'Las preguntas extra se usan después del cupo del día, se '
              'acumulan y no vencen. Cada correo cuenta una sola vez.',
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
          ],
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar tu invitación.',
              alReintentar: () => ref.invalidate(invitacionesProvider),
            ),
          ],
          _ => const [Center(child: CircularProgressIndicator())],
        },
      ],
    );
  }
}

/// «Tu link» y «Tu código», cada uno con su botón para copiar (A38).
class _TarjetaLinkYCodigo extends StatelessWidget {
  const _TarjetaLinkYCodigo({required this.invitaciones});

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
    final etiqueta = TemaSuperaPaes.etiqueta.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Tu link', style: etiqueta),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.link, size: 20, color: TemaSuperaPaes.primario),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  invitaciones.link,
                  style: TemaSuperaPaes.pequenoFuerte.copyWith(
                    color: TemaSuperaPaes.primario,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Copiar link',
                icon: const Icon(Icons.copy_outlined, size: 20),
                onPressed: () => _copiar(context, invitaciones.link, 'Link'),
              ),
            ],
          ),
          const Divider(height: 24),
          Text('Tu código', style: etiqueta),
          Row(
            children: [
              Expanded(
                child: Text(invitaciones.codigo, style: TemaSuperaPaes.display),
              ),
              IconButton(
                tooltip: 'Copiar código',
                icon: const Icon(Icons.copy_outlined, size: 20),
                onPressed: () =>
                    _copiar(context, invitaciones.codigo, 'Código'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'El link abre una página con tu código y los botones para '
            'descargar la app. Quien invites escribe el código al crear su '
            'cuenta.',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ),
    );
  }
}

/// «3 registrados» en su recuadro (A38).
class _Contador extends StatelessWidget {
  const _Contador({required this.valor, required this.texto});

  final int valor;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Tarjeta(
        child: Column(
          children: [
            Text('$valor', style: TemaSuperaPaes.numero),
            Text(
              texto,
              textAlign: TextAlign.center,
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
