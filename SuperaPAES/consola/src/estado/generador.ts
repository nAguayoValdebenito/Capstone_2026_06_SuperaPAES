// C05 · Generador con IA: carga el temario y los lotes, pide uno nuevo y sigue su avance mientras está en
// proceso. Si una consulta del avance falla, conserva lo que ya se ve y lo intenta de nuevo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listarLotes, obtenerResultado, obtenerUso, pedirLote } from '../servicios/generador';
import { obtenerFiltrosBanco } from '../servicios/preguntas';
import type { Lote, PaginaLotes, PedidoLote, UsoIa } from '../tipos/generador';
import { hayPendientes } from '../utilidades/generador';
import { useCarga, type Carga } from './carga';
import { mensajeDeError } from './usuarios-internos';

const ESPERA_MS = 3000;

function useLotes(pagina: number) {
  const [carga, setCarga] = useState<Carga<PaginaLotes>>({ tipo: 'cargando' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const control = new AbortController();
    let espera: ReturnType<typeof setTimeout> | undefined;
    let conDatos = false;
    const consultar = () => {
      listarLotes(pagina, control.signal).then(
        (datos) => {
          if (control.signal.aborted) return;
          conDatos = true;
          setCarga({ tipo: 'lista', datos });
          if (hayPendientes(datos.lotes)) espera = setTimeout(consultar, ESPERA_MS);
        },
        (error: unknown) => {
          if (control.signal.aborted) return;
          if (conDatos) espera = setTimeout(consultar, ESPERA_MS);
          else setCarga({ tipo: 'fallida', ...mensajeDeError(error) });
        },
      );
    };
    consultar();
    return () => {
      control.abort();
      clearTimeout(espera);
    };
  }, [pagina, version]);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { carga, recargar };
}

/**
 * Lo usado de los topes; se vuelve a leer cuando cambian los lotes. Es solo informativo: si falla, no se muestra,
 * y el tope igual se aplica al pedir.
 */
function useUso(lotes: readonly Lote[]) {
  const [uso, setUso] = useState<UsoIa | null>(null);
  const huella = lotes.map((l) => `${l.id}:${String(l.procesadas)}:${l.estado}`).join();
  useEffect(() => {
    const control = new AbortController();
    obtenerUso(control.signal).then(setUso, () => undefined);
    return () => control.abort();
  }, [huella]);
  return uso;
}

/** El resultado se pide cuando el lote ya cerró; mientras tanto se muestra su avance. */
function useResultado(lote: Lote | null) {
  const id = lote && lote.estado !== 'pendiente' ? lote.id : null;
  const cargar = useMemo(
    () => (id === null ? null : (senal: AbortSignal) => obtenerResultado(id, senal)),
    [id],
  );
  return useCarga(cargar);
}

export function useGenerador() {
  const temario = useCarga(obtenerFiltrosBanco);
  const [pagina, setPagina] = useState(1);
  const { carga: lotes, recargar } = useLotes(pagina);
  const [elegido, elegir] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);
  const lista = lotes.tipo === 'lista' ? lotes.datos.lotes : [];
  const lote = lista.find(({ id }) => id === elegido) ?? lista[0] ?? null;
  const uso = useUso(lista);
  const resultado = useResultado(lote);

  const pedir = async (pedido: PedidoLote) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEnviando(true);
    setError(null);
    try {
      const nuevo = await pedirLote(pedido);
      elegir(nuevo.id);
      setPagina(1);
      recargar();
    } catch (causa) {
      setError(mensajeDeError(causa).mensaje);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  return {
    temario,
    lotes,
    lote,
    uso,
    resultado,
    elegir,
    irAPagina: setPagina,
    pedir,
    enviando,
    error,
  };
}
