import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_salud_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_salud_api.dart';
import 'package:supera_paes/dominio/entidades/estado_salud.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_salud.dart';
import 'package:supera_paes/nucleo/cliente_http.dart';

final repositorioSaludProvider = Provider<RepositorioSalud>(
  (ref) =>
      RepositorioSaludApi(FuenteSaludRemota(ref.watch(clienteHttpProvider))),
);

/// Estado de la API que muestra la pantalla de Inicio.
final estadoSaludProvider = FutureProvider<EstadoSalud>(
  (ref) => ref.watch(repositorioSaludProvider).obtenerEstado(),
);
