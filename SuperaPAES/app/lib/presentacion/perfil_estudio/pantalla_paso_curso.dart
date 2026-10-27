import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/borrador_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/con_opciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/guardar_paso.dart';

/// A08 · Perfil, paso 1: tu curso, y A08b si ya egresó (HU-29 esc. 1, CU-05
/// pasos 1 a 3). Con «Corregir mi curso» (A11) es el único paso y guarda.
class PantallaPasoCurso extends ConsumerStatefulWidget {
  const PantallaPasoCurso({super.key});

  @override
  ConsumerState<PantallaPasoCurso> createState() => _PantallaPasoCursoState();
}

class _PantallaPasoCursoState extends ConsumerState<PantallaPasoCurso>
    with GuardarPaso {
  late final TextEditingController _anio;
  String? _errorAnio;

  @override
  void initState() {
    super.initState();
    final anio = ref.read(borradorPerfilProvider).anioEgreso;
    _anio = TextEditingController(text: anio?.toString() ?? '');
  }

  @override
  void dispose() {
    _anio.dispose();
    super.dispose();
  }

  int get _anioEscolar => anioEscolar(DateTime.now());

  /// A08b: el año en que egresó, anterior al año escolar de hoy.
  String? _validarAnio() {
    final anio = int.tryParse(_anio.text.trim());
    if (anio == null) return 'Indica el año en que egresaste.';
    if (anio < 2000 || anio >= _anioEscolar) {
      return 'El año de egreso debe ser ${_anioEscolar - 1} o anterior.';
    }
    return null;
  }

  Future<void> _continuar() async {
    final borrador = ref.read(borradorPerfilProvider);
    if (borrador.esEgresado) {
      final error = _validarAnio();
      setState(() => _errorAnio = error);
      if (error != null) return;
    }
    if (borrador.modo == ModoPerfil.correccion) {
      await _guardarCurso(borrador);
    } else {
      await context.push(Rutas.perfilAreas);
    }
  }

  Future<void> _guardarCurso(Borrador borrador) => guardarYSeguir(
    () => ref
        .read(perfilProvider.notifier)
        .confirmarCurso(borrador.curso!, anioEgreso: borrador.anioEgreso),
    Rutas.inicio,
  );

  @override
  Widget build(BuildContext context) {
    final borrador = ref.watch(borradorPerfilProvider);
    final notificador = ref.read(borradorPerfilProvider.notifier);
    final correccion = borrador.modo == ModoPerfil.correccion;
    return ConOpciones(
      builder: (opciones) => PantallaFormulario(
        separacion: 14,
        pie: PieConError(
          error: errorGuardar,
          boton: FilledButton(
            onPressed: borrador.curso == null || guardando ? null : _continuar,
            child: guardando
                ? const CargandoEnBoton()
                : Text(correccion ? 'Guardar mi curso' : 'Continuar'),
          ),
        ),
        hijos: [
          if (borrador.modo != ModoPerfil.bienvenida)
            EnlaceVolver(
              texto: correccion ? 'Inicio' : 'Perfil',
              destino: correccion ? Rutas.inicio : Rutas.perfil,
            ),
          if (!correccion) const IndicadorPasos(paso: 1, total: 3),
          Encabezado(
            titulo: '¿En qué curso estás?',
            bajada: borrador.esEgresado
                ? null
                : 'Así te mostramos solo contenidos que ya viste en el '
                      'colegio.',
          ),
          Column(
            children: [
              for (final (i, curso) in opciones.cursos.indexed) ...[
                if (i > 0) const SizedBox(height: 8),
                OpcionRadio(
                  texto: curso.esEgresado ? 'Ya egresé' : curso.nombre,
                  seleccionada: borrador.curso == curso.codigo,
                  onTap: () {
                    notificador.elegirCurso(curso.codigo);
                    setState(() => _errorAnio = null);
                  },
                ),
              ],
            ],
          ),
          if (borrador.esEgresado)
            CampoTexto(
              etiqueta: 'Año en que egresaste de 4° medio',
              controller: _anio,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(4),
              ],
              forceErrorText: _errorAnio,
              onChanged: (texto) {
                notificador.cambiarAnioEgreso(int.tryParse(texto));
                if (_errorAnio != null) setState(() => _errorAnio = null);
              },
            ),
          if (borrador.curso case final curso?) _AvisoCurso(curso: curso),
        ],
      ),
    );
  }
}

/// El año en que egresará y que el curso se confirma cada marzo, o que quien
/// ya egresó practica todos los contenidos (RN-24).
class _AvisoCurso extends StatelessWidget {
  const _AvisoCurso({required this.curso});

  final String curso;

  @override
  Widget build(BuildContext context) {
    final anios = aniosParaEgresar(curso);
    if (curso == Curso.egresado || anios == null) {
      return const Aviso(
        tono: TonoAviso.info,
        texto:
            'Como ya egresaste, practicarás todos los contenidos de cada '
            'prueba.',
      );
    }
    final egreso = anioEscolar(DateTime.now()) + anios;
    return Aviso(
      tono: TonoAviso.info,
      textoRico: TextSpan(
        children: [
          const TextSpan(text: 'Egresas de 4° medio en '),
          TextSpan(
            text: '$egreso',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const TextSpan(text: '. Cada marzo te pediremos confirmar tu curso.'),
        ],
      ),
    );
  }
}
