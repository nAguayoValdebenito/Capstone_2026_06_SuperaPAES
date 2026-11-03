// Un error de la página o del formulario que no es de un campo, y que se anuncia al lector de pantalla
// (D01 y D02). Los errores de un campo van con MensajeError.
export function Alerta({ texto }: { texto: string }) {
  return (
    <p className="aviso aviso--error" role="alert">
      {texto}
    </p>
  );
}
