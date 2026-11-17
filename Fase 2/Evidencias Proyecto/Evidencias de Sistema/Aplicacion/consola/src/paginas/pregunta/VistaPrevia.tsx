// Vista previa de C03 (HU-12.4): la pregunta como la verá el estudiante en un teléfono de 390 px, con
// las fórmulas dibujadas con KaTeX y la fuente de la app. Se actualiza mientras se escribe y avisa de
// las fórmulas mal escritas, que el estudiante vería tal como están.
import type { CamposPregunta } from '../../estado/formulario-pregunta';
import type { PruebaTemario } from '../../tipos';
import { formulasDe } from '../../utilidades/formato-pregunta';
import { dibujarFormula } from '../../utilidades/formula';
import { Imagen, TextoConFormulas } from './TextoConFormulas';

/** Los textos de la pregunta que pueden llevar fórmulas, con el nombre con que se avisan. */
function textosDe(campos: CamposPregunta, prueba: PruebaTemario | undefined) {
  const conTexto = prueba?.requiereTexto && campos.texto.modo === 'nuevo';
  return [
    ...(conTexto ? [{ donde: 'el texto de lectura', texto: campos.texto.nuevo.contenido }] : []),
    { donde: 'el enunciado', texto: campos.enunciado },
    ...campos.alternativas.map((a) => ({ donde: `la alternativa ${a.letra}`, texto: a.texto })),
    { donde: 'la explicación', texto: campos.explicacion },
  ];
}

function FormulasConError({ campos, prueba }: { campos: CamposPregunta; prueba?: PruebaTemario }) {
  const malas = textosDe(campos, prueba).flatMap(({ donde, texto }) =>
    formulasDe(texto)
      .filter((tex) => 'error' in dibujarFormula(tex))
      .map((tex) => ({ donde, tex })),
  );
  if (malas.length === 0) return null;
  return (
    <div className="aviso aviso--error" role="status">
      <p>Hay fórmulas que no se pueden dibujar; el estudiante las vería tal como están escritas:</p>
      <ul>
        {malas.map(({ donde, tex }, i) => (
          <li key={i}>
            En {donde}: <code>{tex}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextoDeLectura({ campos }: { campos: CamposPregunta }) {
  const { modo, id, nuevo } = campos.texto;
  if (modo === 'guardado') {
    return (
      <p className="telefono__nota">
        {id === undefined
          ? 'Elige el texto de lectura de la pregunta.'
          : `Arriba de la pregunta va el texto guardado n.º ${String(id)}.`}
      </p>
    );
  }
  return (
    <section className="telefono__lectura" aria-label="Texto de lectura">
      {nuevo.titulo.trim() && <h4>{nuevo.titulo.trim()}</h4>}
      <div className="formato">
        <TextoConFormulas texto={nuevo.contenido} />
        {nuevo.imagenUrl.trim() && (
          <Imagen url={nuevo.imagenUrl.trim()} alternativo={nuevo.titulo.trim()} />
        )}
      </div>
    </section>
  );
}

function Telefono({ campos, prueba }: { campos: CamposPregunta; prueba?: PruebaTemario }) {
  const correcta = campos.alternativas.find((a) => a.letra === campos.correcta);
  return (
    <div className="telefono">
      {prueba?.requiereTexto && <TextoDeLectura campos={campos} />}
      {campos.enunciado.trim() ? (
        <TextoConFormulas texto={campos.enunciado} />
      ) : (
        <p className="telefono__nota">Aquí aparece el enunciado.</p>
      )}
      <ol className="telefono__alternativas">
        {campos.alternativas.map((a) => (
          <li key={a.letra} className="telefono__alternativa">
            <span className="telefono__letra" aria-hidden="true">
              {a.letra}
            </span>
            <TextoConFormulas texto={a.texto} />
          </li>
        ))}
      </ol>
      {campos.explicacion.trim() && (
        <section className="telefono__explicacion" aria-label="Explicación">
          <h4>Al corregir{correcta ? ` · correcta: ${correcta.letra}` : ''}</h4>
          <TextoConFormulas texto={campos.explicacion} />
        </section>
      )}
    </div>
  );
}

export function VistaPrevia({
  campos,
  prueba,
}: {
  campos: CamposPregunta;
  prueba?: PruebaTemario;
}) {
  return (
    <aside className="panel vista-previa" aria-label="Vista previa en la app">
      <h2>Vista previa en la app</h2>
      <p className="campo__ayuda">
        Las fórmulas se ven como las verá el estudiante. Escríbelas en LaTeX entre signos $, o entre
        $$ para que vayan en su propia línea.
      </p>
      <FormulasConError campos={campos} prueba={prueba} />
      <Telefono campos={campos} prueba={prueba} />
    </aside>
  );
}
