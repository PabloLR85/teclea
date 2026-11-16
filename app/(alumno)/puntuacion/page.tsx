import { requireStudent } from "@/lib/session";
import { computeGrade, formatGrade, normalizeBaremo } from "@/lib/scoring";
import { PASS_ACCURACY } from "@/lib/lessons";

export default async function PuntuacionPage() {
  const { klass } = await requireStudent();
  const b = normalizeBaremo(klass.baremo);
  // Ejemplo: 3 minutos, 450 pulsaciones, 9 errores
  const exNet = Math.max(0, (450 - 9 * b.penalty) / 3);
  const exAcc = (441 / 450) * 100;
  const exGrade = computeGrade(exNet, exAcc, b);

  const box = "card flex flex-col gap-3 p-6 text-[15px] leading-relaxed text-body";
  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="kicker">Grupo {klass.code}</span>
        <h1 className="h1 m-0">Cómo se puntúa</h1>
      </div>

      <section className={box}>
        <h2 className="h2 m-0">1. Lo que se mide</h2>
        <ul className="m-0 flex flex-col gap-1.5 pl-5">
          <li><strong>Pulsaciones:</strong> cada carácter que escribes, espacios incluidos.</li>
          <li><strong>Errores:</strong> cada tecla equivocada, cada carácter que te saltas y cada carácter de más. Uno saltado cuenta como un solo error: el resto del texto vuelve a cuadrar.</li>
          <li><strong>Precisión:</strong> el porcentaje de pulsaciones sin error.</li>
          <li>
            <strong>Pulsaciones netas por minuto:</strong> la cifra principal. Cada error resta {b.penalty} pulsaciones:
            <span className="mt-1 block rounded-lg bg-ground px-3 py-2 font-mono text-sm">netas/min = (pulsaciones − errores × {b.penalty}) / minutos</span>
          </li>
        </ul>
        <p className="m-0">Equivocarse cuesta más que ir despacio: en grabación de datos importa más un dato bien metido que la velocidad.</p>
      </section>

      <section className={box}>
        <h2 className="h2 m-0">2. Lecciones de práctica</h2>
        <ul className="m-0 flex flex-col gap-1.5 pl-5">
          <li>Una lección se <strong>supera</strong> al completar todo el texto con al menos un <strong>{PASS_ACCURACY} % de precisión</strong>. Entonces se desbloquea la siguiente.</li>
          <li>Puedes repetir cualquier lección las veces que quieras. Se guarda tu mejor marca de netas por minuto.</li>
          <li>Las lecciones no ponen nota: sirven para practicar y para el ranking.</li>
        </ul>
      </section>

      <section className={box}>
        <h2 className="h2 m-0">3. Formularios</h2>
        <ul className="m-0 flex flex-col gap-1.5 pl-5">
          <li>Cada campo se compara con el dato del documento. Una cifra cambiada o una tilde olvidada son errores; un campo vacío cuenta todos sus caracteres como error.</li>
          <li><strong>En práctica</strong>, el registro solo se graba si está completo y exacto. Cada vez que pulsas Intro con datos mal escritos, esos fallos suman errores aunque luego los corrijas.</li>
          <li><strong>En pruebas</strong>, el registro se graba si está completo y con el formato correcto (código postal, NIF, teléfono, fecha, importes...). Los fallos de contenido se puntúan al entregar.</li>
          <li>Los espacios al principio o al final de un campo no cuentan.</li>
        </ul>
      </section>

      <section className={box}>
        <h2 className="h2 m-0">4. Pruebas y nota</h2>
        <p className="m-0">La nota sale de tus netas por minuto, con el baremo de tu clase:</p>
        <ul className="m-0 flex flex-col gap-1.5 pl-5">
          <li>Desde <strong>{b.min5} netas/min</strong>, un 5. Por debajo, la nota baja en proporción hasta el 0.</li>
          <li>Desde <strong>{b.max10} netas/min</strong>, un 10. Entre medias, sube en proporción.</li>
          <li>Si tu precisión no llega al <strong>{b.minAcc} %</strong>, la nota máxima es un 4, aunque hayas ido muy rápido.</li>
          <li>Si repites una prueba, cuenta tu <strong>mejor intento</strong>. Algunas pruebas son exámenes con un número máximo de intentos.</li>
          <li>Si la prueba tiene límite de tiempo, se entrega sola al acabar. Si no lo tiene, la velocidad se calcula con lo que tardes.</li>
        </ul>
        <p className="m-0 rounded-xl bg-accent-soft px-4 py-3 text-accent-ink">
          <strong>Ejemplo.</strong> En 3 minutos escribes 450 pulsaciones con 9 errores: (450 − 9 × {b.penalty}) / 3 = {Math.round(exNet)} netas/min, con un {Math.round(exAcc)} % de precisión. Nota: <strong>{formatGrade(exGrade)}</strong>.
        </p>
      </section>

      <section className={box}>
        <h2 className="h2 m-0">5. Ranking</h2>
        <ul className="m-0 flex flex-col gap-1.5 pl-5">
          <li><strong>Esta semana:</strong> tu mejor marca de netas por minuto desde el lunes.</li>
          <li><strong>General:</strong> la media de tus 5 mejores marcas, para premiar la regularidad.</li>
          <li>Cuentan lecciones, formularios, pruebas y carreras de al menos 50 caracteres.</li>
        </ul>
      </section>

      <section className={box}>
        <h2 className="h2 m-0">6. Intentos en revisión</h2>
        <p className="m-0">
          Si la app detecta texto pegado, una velocidad imposible o una entrega fuera de tiempo, el intento queda <strong>en revisión</strong>: no puntúa en el ranking y su nota no cuenta hasta que el profesor lo valide.
        </p>
      </section>
    </div>
  );
}
