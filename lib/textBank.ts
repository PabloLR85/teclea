import { FORMS } from "./forms";

// Banco de textos para pruebas y carreras. Todo el contenido es original; los datos son ficticios.

export type BankText = { id: string; category: string; label: string; text: string };

export const BANK_CATEGORIES = [
  "Alfabético básico",
  "Alfabético completo",
  "Teclado numérico",
  "Datos de grabación",
] as const;

// Generador determinista: los textos numericos salen siempre iguales.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const int = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const eur = (n: number) => n.toFixed(2).replace(".", ",");

function build(seed: number, minLength: number, item: (r: () => number) => string) {
  const r = rng(seed);
  const out: string[] = [];
  let len = 0;
  while (len < minLength) {
    const it = item(r);
    out.push(it);
    len += it.length + 1;
  }
  return out.join(" ");
}

const CPS = ["27001", "27002", "27003", "27400", "27800", "15001", "15003", "32005", "36202", "36001", "28001", "08001", "46002", "41001", "48001"];

const NUMERIC: BankText[] = [
  {
    id: "num-cp-tel",
    category: "Teclado numérico",
    label: "Códigos postales y teléfonos",
    text: build(11, 760, (r) => `${pick(r, CPS)} ${pick(r, ["982", "981", "988", "986"])}${pad(int(r, 100000, 999999), 6)}`),
  },
  {
    id: "num-importes",
    category: "Teclado numérico",
    label: "Importes con decimales",
    text: build(23, 760, (r) => eur(int(r, 50, 250000) / 100)),
  },
  {
    id: "num-fechas",
    category: "Teclado numérico",
    label: "Fechas",
    text: build(37, 760, (r) => `${pad(int(r, 1, 28), 2)}/${pad(int(r, 1, 12), 2)}/${int(r, 2025, 2027)}`),
  },
  {
    id: "num-cantidades",
    category: "Teclado numérico",
    label: "Referencias, unidades e importes",
    text: build(41, 760, (r) => {
      const u = int(r, 1, 24);
      const p = int(r, 95, 15990) / 100;
      return `${int(r, 10000, 99999)} ${u} ${eur(p)} ${eur(u * p)}`;
    }),
  },
];

const ALPHA_BASIC: BankText[] = [
  {
    id: "alfa-puesto",
    category: "Alfabético básico",
    label: "El puesto de trabajo (sin tildes ni mayúsculas)",
    text: "el puesto de trabajo debe estar limpio y ordenado. la silla tiene que quedar a la altura de la mesa y la pantalla frente a los ojos. los pies van apoyados en el suelo y la espalda recta. antes de empezar coloca los dedos en la fila guia. la mano izquierda va sobre a s d f y la mano derecha sobre j k l ñ. los dedos indices notan una marca en la f y en la j. desde ahi cada dedo sube y baja a su tecla y vuelve siempre a su sitio. no mires el teclado, mira el texto que copias. al principio iras despacio, pero con un poco de trabajo cada dia la velocidad llega sola.",
  },
  {
    id: "alfa-jornada",
    category: "Alfabético básico",
    label: "Una jornada de grabación (sin tildes ni mayúsculas)",
    text: "la jornada empieza a las ocho. lo primero es revisar la bandeja de entrada y separar los documentos por tipo. a un lado van los pedidos, en otro las facturas y en otro las fichas de clientes. despues se graba cada documento en el programa de la empresa. hay que leer con calma, escribir sin prisa y comprobar cada dato antes de pasar al siguiente. a media mañana se hace una pausa corta para descansar la vista y mover los hombros. por la tarde se archivan los papeles ya grabados y se prepara el trabajo del dia siguiente. un buen grabador termina la jornada con todo al dia y sin errores.",
  },
  {
    id: "alfa-consejos",
    category: "Alfabético básico",
    label: "Consejos para no fallar (sin tildes ni mayúsculas)",
    text: "para escribir sin errores lo mas importante es el ritmo. es mejor ir algo mas despacio y mantener el mismo paso que correr y equivocarse. si fallas una tecla, no te pares a mirar el teclado. sigue leyendo el texto y corrige el fallo con calma. respira, relaja los hombros y deja las muñecas sueltas, sin apoyarlas en la mesa. cada dedo tiene sus teclas y siempre vuelve a la fila guia. con el tiempo los dedos encuentran solos el camino y la vista se queda en el papel. entonces la velocidad sube casi sin darte cuenta.",
  },
];

const ALPHA_FULL: BankText[] = [
  {
    id: "texto-grabacion",
    category: "Alfabético completo",
    label: "El oficio de grabador",
    text: "El trabajo de grabación de datos consiste en introducir información en un sistema informático de forma rápida y sin errores. Cada día se graban pedidos, facturas, fichas de clientes, encuestas y registros de todo tipo. Un dato mal escrito puede parecer un detalle pequeño, pero tiene consecuencias: un paquete que llega a la dirección equivocada, una factura con un importe incorrecto o un cliente que no recibe un aviso importante. Por eso en este oficio la precisión vale más que la velocidad. La velocidad llega con la práctica diaria, cuando los dedos aprenden el camino de cada tecla y la vista deja de buscar en el teclado. Antes de empezar cada jornada conviene revisar el puesto: la silla a la altura correcta, los pies apoyados en el suelo, la pantalla frente a los ojos y a un brazo de distancia, y las muñecas sueltas, sin apoyarlas en la mesa. Un buen grabador lee la línea completa antes de escribirla, mantiene un ritmo constante y corrige cada error en el momento en que lo detecta.",
  },
  {
    id: "texto-proteccion",
    category: "Alfabético completo",
    label: "Confidencialidad de los datos",
    text: "Quien graba datos trabaja a diario con información personal: nombres, direcciones, teléfonos, cuentas de correo y, a veces, datos económicos. Esa información pertenece a las personas, no a la empresa ni al grabador, y solo puede usarse para la finalidad con la que se recogió. Por eso hay normas que conviene cumplir siempre. No se comentan datos de clientes fuera del trabajo, ni siquiera de pasada. La pantalla se bloquea al levantarse del puesto, aunque sea un momento. Los documentos en papel no se dejan a la vista y, cuando ya no hacen falta, se destruyen en la trituradora, nunca en la papelera. Las contraseñas son personales y no se apuntan en notas pegadas al monitor. Si se detecta un error o un posible acceso indebido, se avisa enseguida al responsable. Tratar bien los datos es parte del oficio, igual que escribir rápido y sin fallos.",
  },
  {
    id: "texto-archivo",
    category: "Alfabético completo",
    label: "Organización del archivo",
    text: "Un archivo ordenado ahorra horas de trabajo. Cada documento debe tener un sitio fijo y fácil de encontrar. Lo habitual es clasificar primero por tipo de documento y después por fecha o por número. Las carpetas se rotulan con letra clara y siempre con el mismo criterio: por ejemplo, «Facturas de proveedores, noviembre de 2026». Antes de archivar un papel hay que comprobar que ya está grabado y marcarlo con una señal o un sello. Así nadie lo vuelve a introducir por error. Los expedientes que se consultan a menudo se guardan a mano; los antiguos, en el archivo general. Cada año se revisa qué documentos pueden destruirse, según los plazos que marque la empresa. Cuando todo el equipo sigue las mismas normas, cualquiera encuentra lo que busca en pocos segundos.",
  },
  {
    id: "texto-cliente",
    category: "Alfabético completo",
    label: "Atención al cliente por escrito",
    text: "Muchas consultas de clientes llegan por escrito: correos, formularios de la web o mensajes. Responder bien empieza por leer con atención y entender qué necesita la persona. La respuesta debe ser breve, educada y concreta. Se saluda por el nombre, se contesta a lo que se pregunta y se indica el siguiente paso: cuándo llegará el pedido, qué documento falta o a quién debe dirigirse. Conviene evitar las abreviaturas y revisar la ortografía antes de enviar, porque un texto con faltas transmite descuido. Si el cliente está molesto, se reconoce el problema sin discutir y se ofrece una solución. Por último, se registra la consulta en el sistema con la fecha, el motivo y la respuesta dada, para que cualquier compañero pueda continuar el caso.",
  },
];

// Textos de datos sacados de los formularios (mismos datos ficticios)
const DATA_TEXTS: BankText[] = ["cliente", "pedido", "factura"].map((id) => {
  const f = FORMS.find((x) => x.id === id)!;
  return {
    id: `datos-${id}`,
    category: "Datos de grabación",
    label: `${f.title} (texto continuo)`,
    text: f.records.map((r) => f.doc(r).join(" ")).join(" "),
  };
});

export const TEXT_BANK: BankText[] = [...ALPHA_BASIC, ...ALPHA_FULL, ...NUMERIC, ...DATA_TEXTS];

export function findBankText(id: string): BankText | null {
  return TEXT_BANK.find((t) => t.id === id) ?? null;
}
