import 'package:supera_paes/nucleo/constantes.dart';

/// Dueña de cada dirección existente: no se renombra ningún enlace profundo.
const Map<String, String> pestanaPorRuta = {
  Rutas.inicio: Rutas.inicio,
  Rutas.practicar: Rutas.practicar,
  Rutas.evaluaciones: Rutas.evaluaciones,
  Rutas.progreso: Rutas.progreso,
  Rutas.perfil: Rutas.perfil,
  Rutas.verificarCorreo: Rutas.inicio,
  Rutas.cupoAgotado: Rutas.inicio,
  Rutas.repaso: Rutas.inicio,
  Rutas.elegirAlcance: Rutas.practicar,
  Rutas.sinPreguntas: Rutas.practicar,
  Rutas.ofrecerDiagnostico: Rutas.practicar,
  Rutas.resumenPractica: Rutas.practicar,
  Rutas.antesDeEmpezar: Rutas.evaluaciones,
  Rutas.antesDelEnsayo: Rutas.evaluaciones,
  Rutas.resultado: Rutas.evaluaciones,
  Rutas.revision: Rutas.evaluaciones,
  Rutas.historial: Rutas.progreso,
  Rutas.miSuscripcion: Rutas.perfil,
  Rutas.planes: Rutas.perfil,
  Rutas.invitaciones: Rutas.perfil,
  Rutas.misDatos: Rutas.perfil,
  Rutas.puntajes: Rutas.perfil,
  Rutas.borrarCuenta: Rutas.perfil,
  Rutas.terminos: Rutas.perfil,
  Rutas.privacidad: Rutas.perfil,
};

const Set<String> rutasConcentracion = {
  Rutas.pregunta,
  Rutas.correccion,
  Rutas.preguntaConReloj,
  Rutas.verTodas,
};

/// Acceso, perfil inicial y concentración se abren sobre el navegador raíz.
/// Los documentos legales son públicos, pero muestran la barra al abrirlos
/// con sesión y perfil completo. Sus direcciones siguen siendo las mismas.
const Set<String> rutasSinBarra = {
  Rutas.cargando,
  Rutas.ingreso,
  Rutas.crearCuenta,
  Rutas.recuperarContrasena,
  Rutas.perfilCurso,
  Rutas.perfilAreas,
  Rutas.perfilPruebas,
  ...rutasConcentracion,
};

/// Variantes internas de Planes para conservar la pestaña desde que se abre.
/// /planes sigue siendo la dirección canónica y pertenece a Perfil.
String rutaPlanesEnRama(String rama) =>
    rama == Rutas.perfil ? Rutas.planes : '$rama/planes';

String? pestanaDeRuta(String ruta) {
  final directa = pestanaPorRuta[ruta];
  if (directa != null) return directa;
  for (final rama in pestanaPorRuta.values.toSet()) {
    if (rutaPlanesEnRama(rama) == ruta) return rama;
  }
  return null;
}
