// Encabezado de una tabla: una celda por columna, en orden.
export function EncabezadoTabla({ columnas }: { columnas: readonly string[] }) {
  return (
    <thead>
      <tr>
        {columnas.map((columna) => (
          <th key={columna} scope="col">
            {columna}
          </th>
        ))}
      </tr>
    </thead>
  );
}
