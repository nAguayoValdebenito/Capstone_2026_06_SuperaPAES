import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/cuenta_regresiva_cupo.dart';
import 'package:supera_paes/presentacion/comunes/estado_usuario.dart';
import 'package:supera_paes/presentacion/comunes/navegar.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Cupo agotado (A22; HU-33 esc. 1 y 2, HU-47 esc. 3, CU-07a, CU-07b, RF-A09,
/// RN-01, RN-04): se abre cuando la práctica recibe `CUPO_AGOTADO`. Cuenta el
/// tiempo que falta para el reinicio del cupo y muestra cómo seguir hoy
/// (verificar el correo si falta, invitar o suscribirse) y lo que no usa cupo:
/// el repaso y el mini-ensayo.
class PantallaCupoAgotado extends ConsumerWidget {
  const PantallaCupoAgotado({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sinVerificar =
        ref.watch(estadoUsuarioProvider).value?.verificado == false;
    final usuario = ref.watch(estadoUsuarioProvider).value;
    final opciones = ref.watch(opcionesPerfilProvider).value;
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Inicio', destino: Rutas.inicio),
        const _EncabezadoCupo(),
        if (ref.watch(estadoUsuarioProvider).value?.cupo.reiniciaEn
            case final reinicia?)
          CuentaRegresivaCupo(reiniciaEn: reinicia),
        if (usuario != null && opciones != null)
          for (final id in usuario.perfil.pruebas.where(usuario.cubre))
            OutlinedButton(
              onPressed: () {
                ref.read(borradorPracticaProvider.notifier).elegirPrueba(id);
                context.go(Rutas.practicar);
              },
              child: Text(
                'Practicar ${opciones.prueba(id)?.nombreCorto ?? ''}'
                ' · incluida en tu plan',
              ),
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
              onTap: () => abrirPlanes(context),
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
              texto: 'Ver diagnósticos',
              detalle: 'No usan tu cupo de práctica.',
              onTap: () => context.go(Rutas.evaluaciones),
            ),
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

/// Cuánto falta para [reiniciaEn], la hora que entrega la API: «Vuelve en
/// 6 h 12 min». Redondea hacia arriba, para no decir nunca «0 min». Sin esa
/// hora (el cupo no cargó), dice la hora fija del reinicio (RN-02).
String textoDeRegreso(DateTime? reiniciaEn, DateTime ahora) {
  const sigue = 'o sigue ahora con lo que no usa cupo.';
  if (reiniciaEn == null) return 'Vuelve a las 00:00 (hora de Chile), $sigue';
  final falta = reiniciaEn.difference(ahora);
  if (falta <= Duration.zero) {
    return 'Tu cupo ya se reinició. Vuelve a Inicio para seguir practicando.';
  }
  final minutos = (falta.inSeconds + 59) ~/ 60;
  final tiempo = [
    if (minutos >= 60) '${minutos ~/ 60} h',
    if (minutos % 60 > 0) '${minutos % 60} min',
  ].join(' ');
  return 'Vuelve en $tiempo, $sigue';
}

/// Título y cuenta regresiva, que se actualiza sola mientras está abierta.
class _EncabezadoCupo extends ConsumerStatefulWidget {
  const _EncabezadoCupo();

  @override
  ConsumerState<_EncabezadoCupo> createState() => _EncabezadoCupoState();
}

class _EncabezadoCupoState extends ConsumerState<_EncabezadoCupo> {
  late final Timer _reloj;

  @override
  void initState() {
    super.initState();
    _reloj = Timer.periodic(
      const Duration(seconds: 30),
      (_) => setState(() {}),
    );
  }

  @override
  void dispose() {
    _reloj.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(estadoUsuarioProvider).value;
    final reiniciaEn = estado?.cupo.reiniciaEn;
    final pocas =
        estado != null &&
        !estado.cupo.agotado &&
        estado.cupoRestante + estado.bonos < BorradorPractica.cantidadMinima;
    return Encabezado(
      titulo: pocas
          ? 'Te quedan ${estado.cupoRestante + estado.bonos} preguntas'
          : 'Por hoy completaste tu cupo',
      bajada:
          '${pocas ? 'Una práctica necesita al menos '
                    '${BorradorPractica.cantidadMinima} preguntas. ' : ''}'
          '${textoDeRegreso(reiniciaEn, clock.now())}',
    );
  }
}
