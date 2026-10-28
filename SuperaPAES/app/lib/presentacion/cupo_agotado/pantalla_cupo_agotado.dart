import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Cupo agotado (A22; HU-33 esc. 1 y 2, HU-47 esc. 3, CU-07a, CU-07b, RF-A09,
/// RN-01, RN-04): se abre cuando la práctica recibe `CUPO_AGOTADO`. Explica
/// cuándo se reinicia el cupo, cómo seguir hoy (verificar el correo si falta,
/// invitar o suscribirse) y lo que no usa cupo: el repaso y el mini-ensayo.
class PantallaCupoAgotado extends ConsumerWidget {
  const PantallaCupoAgotado({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sinVerificar =
        ref.watch(sesionProvider).value?.estudiante.correoVerificado == false;
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Inicio', destino: Rutas.inicio),
        const Encabezado(
          titulo: 'Usaste tus preguntas de hoy',
          bajada: 'Se reinician a las 00:00 (hora de Chile). Para seguir hoy:',
        ),
        ListaDeFilas(
          filas: [
            if (sinVerificar)
              FilaNavegacion(
                icono: Icons.mark_email_read_outlined,
                texto: 'Verifica tu correo',
                detalle: 'Pasas de 10 a 20 preguntas diarias.',
                onTap: () => context.push(Rutas.verificarCorreo),
              ),
            FilaNavegacion(
              icono: Icons.group_add_outlined,
              texto: 'Invita a alguien',
              detalle:
                  '5 preguntas extra por cada invitado que verifique su '
                  'correo.',
              onTap: () => context.push(Rutas.invitaciones),
            ),
            FilaNavegacion(
              icono: Icons.workspace_premium_outlined,
              texto: 'Suscríbete',
              detalle: 'Practica sin límite con un plan mensual o anual.',
              onTap: () => context.push(Rutas.planes),
            ),
          ],
        ),
        Semantics(
          header: true,
          child: const Text('No usan tu cupo', style: TemaSuperaPaes.h2),
        ),
        ListaDeFilas(
          filas: [
            FilaNavegacion(
              icono: Icons.replay,
              texto: 'Repasar errores',
              detalle: 'Tus 10 falladas más recientes.',
              onTap: () => context.push(Rutas.repaso),
            ),
            FilaNavegacion(
              icono: Icons.timer_outlined,
              texto: 'Mini-ensayo',
              detalle: '1 gratis al mes por prueba.',
              onTap: () => context.go(Rutas.evaluaciones),
            ),
          ],
        ),
      ],
    );
  }
}
