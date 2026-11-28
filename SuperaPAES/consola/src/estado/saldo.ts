import { useCallback, useState } from 'react';
import { consultarSaldo, consultarTarifas, registrarTarifa } from '../servicios/saldo';
import type { ConsultaSaldo, NuevaTarifa } from '../tipos/saldo';
import { useCarga } from './carga';
import { mensajeDeError } from './usuarios-internos';

export function useSaldo(docenteId: number | null) {
  const [filtros, setFiltros] = useState<ConsultaSaldo>({});
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const cargar = useCallback(
    (signal: AbortSignal) => consultarSaldo(docenteId, filtros, pagina, signal),
    [docenteId, filtros, pagina],
  );
  return {
    carga: useCarga(cargar, version),
    pagina,
    filtrar: (valores: ConsultaSaldo) => {
      setFiltros(valores);
      setPagina(1);
    },
    irAPagina: setPagina,
    reintentar: () => setVersion((v) => v + 1),
  };
}
export function useTarifas() {
  const [version, setVersion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const carga = useCarga(consultarTarifas, version);
  async function guardar(datos: NuevaTarifa) {
    if (guardando) return;
    setGuardando(true);
    setAviso(null);
    try {
      await registrarTarifa(datos);
      setAviso({
        texto: 'La tarifa quedó registrada. Los montos anteriores se conservan.',
        error: false,
      });
      setVersion((v) => v + 1);
    } catch (error) {
      setAviso({ texto: mensajeDeError(error).mensaje, error: true });
    } finally {
      setGuardando(false);
    }
  }
  return { carga, guardar, guardando, aviso, reintentar: () => setVersion((v) => v + 1) };
}
