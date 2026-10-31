// FabricaProveedores: elige la implementación de IA, correo y pagos según la configuración
// (PROVEEDOR_IA, PROVEEDOR_CORREO, PROVEEDOR_PAGOS). Los módulos reciben los proveedores ya
// creados y nunca instancian un adaptador por su cuenta.
import type {
  Configuracion,
  ConfiguracionCorreo,
  ConfiguracionIA,
  ConfiguracionPagos,
} from '../comun/configuracion.js';
import type { Reloj } from '../comun/reloj.js';
import { ProveedorCorreoConsola } from './correo/consola.js';
import type { ProveedorCorreo } from './correo/proveedor.js';
import { ProveedorCorreoSmtp } from './correo/smtp.js';
import { ProveedorIADeepSeek } from './ia/deepseek.js';
import { ProveedorIAGemini } from './ia/gemini.js';
import type { ProveedorIA } from './ia/proveedor.js';
import { ProveedorIASimulado } from './ia/simulado.js';
import { PasarelaAppStore } from './pagos/app-store.js';
import { PasarelaGooglePlay } from './pagos/google-play.js';
import type { PasarelasPorTienda } from './pagos/pasarela.js';
import { PasarelaPagoSimulada } from './pagos/simulado.js';

export type * from './correo/proveedor.js';
export type * from './ia/proveedor.js';
export type * from './pagos/pasarela.js';

export interface Proveedores {
  ia: ProveedorIA;
  correo: ProveedorCorreo;
  pagos: PasarelasPorTienda;
}

export const FabricaProveedores = {
  crear(config: Pick<Configuracion, 'ia' | 'correo' | 'pagos'>, reloj: Reloj): Proveedores {
    return {
      ia: FabricaProveedores.ia(config.ia),
      correo: FabricaProveedores.correo(config.correo),
      pagos: FabricaProveedores.pagos(config.pagos, reloj),
    };
  },

  ia(config: ConfiguracionIA): ProveedorIA {
    switch (config.proveedor) {
      case 'simulado':
        return new ProveedorIASimulado();
      case 'deepseek':
        return new ProveedorIADeepSeek(config.claveApi);
      case 'gemini':
        return new ProveedorIAGemini(config.claveApi);
    }
  },

  correo(config: ConfiguracionCorreo): ProveedorCorreo {
    switch (config.proveedor) {
      case 'consola':
        return new ProveedorCorreoConsola();
      case 'smtp':
        return new ProveedorCorreoSmtp(config);
    }
  },

  pagos(config: ConfiguracionPagos, reloj: Reloj): PasarelasPorTienda {
    switch (config.proveedor) {
      case 'simulado':
        return {
          google_play: new PasarelaPagoSimulada('google_play', reloj),
          app_store: new PasarelaPagoSimulada('app_store', reloj),
        };
      case 'tiendas':
        return {
          google_play: new PasarelaGooglePlay(config.googlePlay, { reloj }),
          app_store: new PasarelaAppStore(config.appStore),
        };
    }
  },
};
