// Un error de la página o del formulario que no es de un campo, y que se anuncia al lector de pantalla
// (D01, D02 y C16), con el código del error de la API si lo hay. Los errores de un campo van con
// MensajeError.
export function Alerta({ texto, codigo }: { texto: string; codigo?: string }) {
  return (
    <p className="aviso aviso--error" role="alert">
      {texto}
      {codigo && <span className="estado__codigo"> ({codigo})</span>}
    </p>
  );
}
