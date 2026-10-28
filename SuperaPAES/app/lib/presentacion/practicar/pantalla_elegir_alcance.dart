import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/practicar/con_datos_practica.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Elegir un eje, un contenido o una habilidad de la prueba (A14; HU-30
/// esc. 1, RN-24). Los contenidos van por eje, con buscador, y solo los que
/// se enseñan hasta el curso del estudiante. Se abre desde A13 con
/// `?tipo=eje`, `contenido` o `habilidad`.
class PantallaElegirAlcance extends ConsumerStatefulWidget {
  const PantallaElegirAlcance({super.key});

  @override
  ConsumerState<PantallaElegirAlcance> createState() =>
      _PantallaElegirAlcanceState();
}

class _PantallaElegirAlcanceState extends ConsumerState<PantallaElegirAlcance> {
  final _buscar = TextEditingController();

  @override
  void dispose() {
    _buscar.dispose();
    super.dispose();
  }

  TipoAlcance get _tipo =>
      switch (GoRouterState.of(context).uri.queryParameters['tipo']) {
        'eje' => TipoAlcance.eje,
        'habilidad' => TipoAlcance.habilidad,
        _ => TipoAlcance.contenido,
      };

  @override
  Widget build(BuildContext context) {
    return ConDatosPractica(builder: _contenido);
  }

  Widget _contenido(DatosDePractica datos) {
    final borrador = ref.watch(borradorPracticaProvider);
    final pruebaId = pruebaElegida(borrador, datos.perfil);
    final prueba = pruebaId == null ? null : datos.opciones.prueba(pruebaId);
    final nombre = pruebaId == null
        ? null
        : datos.nombres.prueba(pruebaId)?.nombreEnInicio;
    final tipo = _tipo;
    return PantallaFormulario(
      separacion: 12,
      hijos: [
        const EnlaceVolver(
          texto: 'Personaliza tu práctica',
          destino: Rutas.practicar,
        ),
        Encabezado(titulo: '${_titulos[tipo]} de ${nombre ?? 'tu prueba'}'),
        if (tipo == TipoAlcance.contenido)
          TextField(
            controller: _buscar,
            onChanged: (_) => setState(() {}),
            style: TemaSuperaPaes.cuerpo,
            decoration: const InputDecoration(
              hintText: 'Buscar contenido',
              prefixIcon: Icon(Icons.search),
            ),
          ),
        if (prueba != null)
          ..._lista(
            prueba,
            tipo,
            borrador.pruebaId == pruebaId ? borrador.alcance : null,
          ),
        if (tipo == TipoAlcance.contenido)
          if (_notaDelCurso(datos.perfil.curso) case final nota?)
            Text(
              nota,
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
      ],
    );
  }

  static const Map<TipoAlcance, String> _titulos = {
    TipoAlcance.prueba: 'Toda la prueba',
    TipoAlcance.eje: 'Ejes',
    TipoAlcance.contenido: 'Contenidos',
    TipoAlcance.habilidad: 'Habilidades',
  };

  /// Las opciones del tipo; los contenidos, por eje y filtrados por lo que se
  /// escribió en el buscador.
  List<Widget> _lista(
    PruebaPractica prueba,
    TipoAlcance tipo,
    Alcance? actual,
  ) {
    final busqueda = _sinTildes(_buscar.text.trim());
    final grupos = switch (tipo) {
      TipoAlcance.eje => [
        (
          null,
          [for (final eje in prueba.ejes) (id: eje.id, nombre: eje.nombre)],
        ),
      ],
      TipoAlcance.habilidad => [(null, prueba.habilidades)],
      _ => [
        for (final eje in prueba.ejes)
          (
            eje.nombre,
            [
              for (final contenido in eje.contenidos)
                if (_sinTildes(contenido.nombre).contains(busqueda)) contenido,
            ],
          ),
      ],
    };
    final visibles = [
      for (final grupo in grupos)
        if (grupo.$2.isNotEmpty) grupo,
    ];
    if (visibles.isEmpty) {
      return [
        Text(
          busqueda.isEmpty
              ? 'No hay opciones para tu curso en esta prueba.'
              : 'No hay contenidos con «${_buscar.text.trim()}».',
          style: TemaSuperaPaes.cuerpo.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
      ];
    }
    return [
      for (final (titulo, opciones) in visibles) ...[
        if (titulo != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              titulo.toUpperCase(),
              style: TemaSuperaPaes.mini.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
          ),
        for (final opcion in opciones)
          OpcionRadio(
            texto: opcion.nombre,
            seleccionada: actual?.tipo == tipo && actual?.id == opcion.id,
            onTap: () => _elegir(prueba.id, tipo, opcion),
          ),
      ],
    ];
  }

  void _elegir(int pruebaId, TipoAlcance tipo, OpcionConNombre opcion) {
    ref.read(borradorPracticaProvider.notifier)
      ..elegirPrueba(pruebaId)
      ..elegirAlcance(Alcance(tipo, id: opcion.id, nombre: opcion.nombre));
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Rutas.practicar);
    }
  }

  /// Egresado ve todo; en los demás cursos se explica por qué faltan los
  /// contenidos de cursos superiores (RN-24).
  static String? _notaDelCurso(Curso? curso) {
    if (curso == null || curso.esEgresado) return null;
    return 'Ves los contenidos que se enseñan hasta ${curso.nombre}. Los de '
        'cursos superiores aparecerán cuando llegues a ellos.';
  }

  /// Para buscar sin importar mayúsculas ni tildes.
  static String _sinTildes(String texto) {
    const conTilde = 'áéíóúüñ';
    const sinTilde = 'aeiouun';
    final minusculas = texto.toLowerCase();
    final salida = StringBuffer();
    for (final letra in minusculas.split('')) {
      final i = conTilde.indexOf(letra);
      salida.write(i < 0 ? letra : sinTilde[i]);
    }
    return salida.toString();
  }
}
