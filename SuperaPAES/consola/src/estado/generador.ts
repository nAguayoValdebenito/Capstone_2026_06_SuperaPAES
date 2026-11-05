// C05 · Generador con IA: carga el temario y los lotes, pide uno nuevo y sigue su avance mientras está en
// proceso. Si una consulta del avance falla, conserva lo que ya se ve y lo intenta de nuevo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { listarLotes, pedirLote } from '../servicios/generador';
import { obtenerFiltrosBanco } from '../servicios/preguntas';
import type { PaginaLotes, PedidoLote } from '../tipos/generador';
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

  return { temario, lotes, lote, elegir, irAPagina: setPagina, pedir, enviando, error };
}
