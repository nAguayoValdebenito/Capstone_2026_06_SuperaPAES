import { ConsultaSaldo } from './ConsultaSaldo';

export function PaginaMiSaldo() {
  return (
    <section className="pagina pagina--ancha">
      <h1>Mi saldo</h1>
      <p className="pagina__aviso">
        Consulta lo que has acumulado por tus revisiones y desempates. Estos montos corresponden al
        trabajo registrado y no indican pagos realizados.
      </p>
      <ConsultaSaldo />
    </section>
  );
}
