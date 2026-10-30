import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/correccion/pantalla_correccion.dart';
import 'package:supera_paes/presentacion/crear_cuenta/pantalla_crear_cuenta.dart';
import 'package:supera_paes/presentacion/cupo_agotado/pantalla_cupo_agotado.dart';
import 'package:supera_paes/presentacion/evaluaciones/pantalla_evaluaciones.dart';
import 'package:supera_paes/presentacion/ingreso/pantalla_ingreso.dart';
import 'package:supera_paes/presentacion/inicio/pantalla_inicio.dart';
import 'package:supera_paes/presentacion/invitaciones/pantalla_invitaciones.dart';
import 'package:supera_paes/presentacion/mis_datos/pantalla_borrar_cuenta.dart';
import 'package:supera_paes/presentacion/mis_datos/pantalla_mis_datos.dart';
import 'package:supera_paes/presentacion/perfil/pantalla_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/pantalla_paso_areas.dart';
import 'package:supera_paes/presentacion/perfil_estudio/pantalla_paso_curso.dart';
import 'package:supera_paes/presentacion/perfil_estudio/pantalla_paso_pruebas.dart';
import 'package:supera_paes/presentacion/planes/pantalla_planes.dart';
import 'package:supera_paes/presentacion/practicar/pantalla_elegir_alcance.dart';
import 'package:supera_paes/presentacion/practicar/pantalla_personalizar_practica.dart';
import 'package:supera_paes/presentacion/practicar/pantalla_resumen_practica.dart';
import 'package:supera_paes/presentacion/practicar/pantalla_sin_preguntas.dart';
import 'package:supera_paes/presentacion/pregunta/pantalla_pregunta.dart';
import 'package:supera_paes/presentacion/privacidad/pantalla_privacidad.dart';
import 'package:supera_paes/presentacion/progreso/pantalla_progreso.dart';
import 'package:supera_paes/presentacion/puntajes/pantalla_puntajes.dart';
import 'package:supera_paes/presentacion/recuperar_contrasena/pantalla_recuperar_contrasena.dart';
import 'package:supera_paes/presentacion/repaso/pantalla_repaso.dart';
import 'package:supera_paes/presentacion/resultado/pantalla_resultado.dart';
import 'package:supera_paes/presentacion/resultado/pantalla_revision.dart';
import 'package:supera_paes/presentacion/terminos/pantalla_terminos.dart';
import 'package:supera_paes/presentacion/verificar_correo/pantalla_verificar_correo.dart';

/// Pantalla navegable de la app. Fuente única para rutas, pestañas y
/// títulos:
/// agregar una pantalla es agregar una entrada aquí.
class Seccion {
  const Seccion(
    this.titulo,
    this.ruta,
    this.icono,
    this.pantalla, {
    this.esPestana = false,
    this.etiquetaPestana,
  });

  final String titulo;
  final String ruta;
  final IconData icono;
  final Widget Function() pantalla;

  /// Si aparece en la barra inferior (DAS 7.4): Inicio, Practicar,
  /// Evaluaciones, Progreso y Perfil.
  final bool esPestana;

  /// Texto de la pestaña cuando es distinto del título de la pantalla.
  final String? etiquetaPestana;
}

const List<Seccion> secciones = [
  // Acceso a la cuenta
  Seccion('Iniciar sesión', Rutas.ingreso, Icons.login, PantallaIngreso.new),
  Seccion(
    'Crear cuenta',
    Rutas.crearCuenta,
    Icons.person_add_alt_outlined,
    PantallaCrearCuenta.new,
  ),
  Seccion(
    'Recuperar contraseña',
    Rutas.recuperarContrasena,
    Icons.lock_reset,
    PantallaRecuperarContrasena.new,
  ),
  Seccion(
    'Términos y condiciones',
    Rutas.terminos,
    Icons.description_outlined,
    PantallaTerminos.new,
  ),
  Seccion(
    'Política de privacidad',
    Rutas.privacidad,
    Icons.privacy_tip_outlined,
    PantallaPrivacidad.new,
  ),
  Seccion(
    'Verificar correo',
    Rutas.verificarCorreo,
    Icons.mark_email_read_outlined,
    PantallaVerificarCorreo.new,
  ),
  // Pestañas, en el orden de la barra inferior
  Seccion(
    'Inicio',
    Rutas.inicio,
    Icons.home_outlined,
    PantallaInicio.new,
    esPestana: true,
  ),
  Seccion(
    'Personaliza tu práctica',
    Rutas.practicar,
    Icons.edit_outlined,
    PantallaPersonalizarPractica.new,
    esPestana: true,
    etiquetaPestana: 'Practicar',
  ),
  Seccion(
    'Evaluaciones',
    Rutas.evaluaciones,
    Icons.timer_outlined,
    PantallaEvaluaciones.new,
    esPestana: true,
  ),
  Seccion(
    'Progreso',
    Rutas.progreso,
    Icons.bar_chart_outlined,
    PantallaProgreso.new,
    esPestana: true,
  ),
  Seccion(
    'Perfil',
    Rutas.perfil,
    Icons.person_outline,
    PantallaPerfil.new,
    esPestana: true,
  ),
  // Práctica (HU-30): elegir qué practicar, sin preguntas suficientes y
  // resumen
  Seccion(
    'Elegir eje, contenido o habilidad',
    Rutas.elegirAlcance,
    Icons.list_alt,
    PantallaElegirAlcance.new,
  ),
  Seccion(
    'Sin preguntas suficientes',
    Rutas.sinPreguntas,
    Icons.search_off,
    PantallaSinPreguntas.new,
  ),
  Seccion(
    'Resumen de la práctica',
    Rutas.resumenPractica,
    Icons.flag_outlined,
    PantallaResumenPractica.new,
  ),
  Seccion(
    'Pregunta',
    Rutas.pregunta,
    Icons.quiz_outlined,
    PantallaPregunta.new,
  ),
  Seccion(
    'Corrección',
    Rutas.correccion,
    Icons.fact_check_outlined,
    PantallaCorreccion.new,
  ),
  Seccion(
    'Cupo agotado',
    Rutas.cupoAgotado,
    Icons.hourglass_empty,
    PantallaCupoAgotado.new,
  ),
  Seccion('Repaso de errores', Rutas.repaso, Icons.replay, PantallaRepaso.new),
  // Resultado y revisión de una evaluación (HU-61)
  Seccion(
    'Resultado',
    Rutas.resultado,
    Icons.assessment_outlined,
    PantallaResultado.new,
  ),
  Seccion(
    'Revisión',
    Rutas.revision,
    Icons.fact_check_outlined,
    PantallaRevision.new,
  ),
  // Desde Perfil
  Seccion(
    'Planes',
    Rutas.planes,
    Icons.workspace_premium_outlined,
    PantallaPlanes.new,
  ),
  Seccion(
    'Invitaciones',
    Rutas.invitaciones,
    Icons.group_add_outlined,
    PantallaInvitaciones.new,
  ),
  Seccion(
    'Mis datos y privacidad',
    Rutas.misDatos,
    Icons.shield_outlined,
    PantallaMisDatos.new,
  ),
  Seccion(
    'Mis puntajes PAES',
    Rutas.puntajes,
    Icons.emoji_events_outlined,
    PantallaPuntajes.new,
  ),
  Seccion(
    'Borrar mi cuenta',
    Rutas.borrarCuenta,
    Icons.delete_outline,
    PantallaBorrarCuenta.new,
  ),
  // Perfil de estudio (HU-29): bienvenida, edición y corrección del curso
  Seccion(
    'Tu curso',
    Rutas.perfilCurso,
    Icons.school_outlined,
    PantallaPasoCurso.new,
  ),
  Seccion(
    'Áreas de carrera',
    Rutas.perfilAreas,
    Icons.explore_outlined,
    PantallaPasoAreas.new,
  ),
  Seccion(
    'Tus pruebas',
    Rutas.perfilPruebas,
    Icons.checklist,
    PantallaPasoPruebas.new,
  ),
];

/// Pasos del perfil de estudio: con el perfil sin completar, la app no deja
/// salir de ellos (salvo a Verificar correo y las pantallas públicas).
const Set<String> rutasPerfilDeEstudio = {
  Rutas.perfilCurso,
  Rutas.perfilAreas,
  Rutas.perfilPruebas,
};

/// Pestañas de la barra inferior, en orden.
final List<Seccion> pestanas = [
  for (final s in secciones)
    if (s.esPestana) s,
];

Seccion? seccionDeRuta(String ruta) {
  for (final seccion in secciones) {
    if (seccion.ruta == ruta) return seccion;
  }
  return null;
}
