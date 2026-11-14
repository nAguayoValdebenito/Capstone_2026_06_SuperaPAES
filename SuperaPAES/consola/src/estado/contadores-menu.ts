// Contadores del menú lateral (D3): cuántas cosas esperan en cada sección, con los datos que la API ya
// entrega. Se piden al entrar y cada vez que se cambia de sección (una acción en una página puede
// cambiarlos). Si una consulta falla, ese contador no se muestra: es un dato de apoyo, no la página.
import { useEffect, useState } from 'react';
import { EVENTO_DATOS_CAMBIADOS } from '../api/cliente';
import { useLocation } from 'react-router';
import { obtenerSeguimiento, listarDesempates, listarMisRevisiones } from '../servicios/revision';
import { contarAvisosPendientes } from '../servicios/busqueda-global';
import { listarSolicitudes } from '../servicios/privacidad';
import type { RolCuentaInterna } from '../tipos';

export interface Contador {
  valor: number;
  /** Pide acción (granate lleno) en lugar de ser un dato del sistema (celeste). */
  alerta: boolean;
}

/** Contadores por ruta de sección. */
export type Contadores = Readonly<Record<string, Contador>>;

type Consulta = (senal: AbortSignal) => Promise<Contador>;

const CONSULTAS: Record<RolCuentaInterna, Record<string, Consulta>> = {
  admin: {
    '/revisiones': async (senal) => ({
      valor: (await obtenerSeguimiento('en_curso', 1, senal)).seguimiento.conteos.en_curso,
      alerta: false,
    }),
    // Pide acción: un aviso pendiente es una pregunta que un estudiante dice que está mal.
    '/avisos-error': async (senal) => ({
      valor: await contarAvisosPendientes(senal),
      alerta: true,
    }),
    '/solicitudes-datos': async (senal) => ({
      valor: (await listarSolicitudes('pendiente', 1, senal)).pendientes,
      alerta: false,
    }),
  },
  docente: {
    '/revision': async (senal) => ({
      valor: (await listarMisRevisiones(senal)).length,
      alerta: true,
    }),
    '/desempates': async (senal) => ({
      valor: (await listarDesempates(senal)).length,
      alerta: false,
    }),
  },
};

/** Los contadores del rol; vacío mientras cargan, sin sesión o con la sesión provisional. */
export function useContadoresMenu(rol: RolCuentaInterna | null, conToken: boolean): Contadores {
  const { pathname } = useLocation();
  const [contadores, cambiar] = useState<Contadores>({});
  const [version, cambiarVersion] = useState(0);

  // Una acción que escribe (resolver un aviso, entregar una revisión…) puede cambiar los contadores:
  // se vuelven a pedir poco después, sin esperar a que se cambie de sección.
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    const alCambiar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => cambiarVersion((v) => v + 1), 300);
    };
    window.addEventListener(EVENTO_DATOS_CAMBIADOS, alCambiar);
    return () => {
      clearTimeout(espera);
      window.removeEventListener(EVENTO_DATOS_CAMBIADOS, alCambiar);
    };
  }, []);

  useEffect(() => {
    if (!rol || !conToken) return;
    const control = new AbortController();
    for (const [ruta, consultar] of Object.entries(CONSULTAS[rol])) {
      consultar(control.signal).then(
        (contador) => {
          if (!control.signal.aborted) cambiar((previos) => ({ ...previos, [ruta]: contador }));
        },
        () => undefined,
      );
    }
    return () => control.abort();
  }, [rol, conToken, pathname, version]);

  return rol && conToken ? contadores : {};
}

/** Qué cuenta cada contador, para la campana de «Requiere atención». */
export const ASUNTO_DE_CONTADOR: Readonly<Record<string, string>> = {
  '/avisos-error': 'avisos de error pendientes',
  '/solicitudes-datos': 'solicitudes de datos pendientes',
  '/revisiones': 'preguntas en revisión',
  '/revision': 'revisiones en tu bandeja',
  '/desempates': 'desempates en tu bandeja',
};
