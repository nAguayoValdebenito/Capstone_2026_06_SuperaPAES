import { useReintentoDesempates } from '../../estado/reintento-desempates';

export function ReintentarDesempates() {
  const estado = useReintentoDesempates();
  return (
    <>
      <button
        className="boton"
        type="button"
        disabled={estado.ocupado}
        onClick={() => {
          void estado.reintentar();
        }}
      >
        Reintentar desempates sin asignar
      </button>
      {estado.mensaje && <p role="status">{estado.mensaje}</p>}
    </>
  );
}
