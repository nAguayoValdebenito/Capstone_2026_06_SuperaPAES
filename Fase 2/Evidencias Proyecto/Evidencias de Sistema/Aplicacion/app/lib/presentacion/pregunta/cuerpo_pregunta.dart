import 'package:flutter/material.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';
import 'package:supera_paes/presentacion/pregunta/texto_de_lectura.dart';

/// El texto de lectura, el enunciado y las alternativas de una pregunta,
/// de la práctica (A17 y A20) o con reloj (A27). Las fórmulas y las imágenes
/// se ven con [TextoConFormulas]. Con [alElegir] en `null` no se puede tocar
/// ninguna alternativa.
List<Widget> cuerpoDePregunta({
  required String enunciado,
  required List<AlternativaVisible> alternativas,
  required int? elegida,
  required ValueChanged<int>? alElegir,
  TextoDeLectura? texto,
  bool conMovimiento = false,
}) => [
  if (texto != null) TarjetaTextoDeLectura(texto: texto),
  Semantics(
    header: true,
    child: TextoConFormulas(enunciado, estilo: TemaSuperaPaes.cuerpoFuerte),
  ),
  for (final alternativa in alternativas)
    OpcionAlternativa(
      conMovimiento: conMovimiento,
      letra: alternativa.letra,
      texto: alternativa.texto,
      seleccionada: alternativa.id == elegida,
      onTap: alElegir == null ? null : () => alElegir(alternativa.id),
    ),
];
