// Mensaje de error bajo un campo de formulario (C03, C10). No dibuja nada si el campo no tiene error.
export function MensajeError({ id, texto }: { id: string; texto: string | undefined }) {
  if (!texto) return null;
  return (
    <p id={id} className="campo__error" role="alert">
      {texto}
    </p>
  );
}
