export type Lesson = { id: string; title: string; text: string };
export type Level = { id: number; title: string; description: string; lessons: Lesson[] };

// Precision necesaria para dar una leccion por superada y desbloquear la siguiente.
export const PASS_ACCURACY = 90;

export const LEVELS: Level[] = [
  {
    id: 1,
    title: "Fila guía",
    description: "Posición de las manos sobre asdf y ñlkj. Los índices descansan en la f y la j.",
    lessons: [
      { id: "1-1", title: "Posición de base", text: "asdf ñlkj asdf ñlkj ff jj dd kk ss ll aa ññ fj dk sl añ fjdksla ñlkjfdsa" },
      { id: "1-2", title: "Repetición de teclas", text: "fff jjj ddd kkk sss lll aaa ñññ fdsa jklñ asdf ñlkj fdsa jklñ fjfj dkdk slsl" },
      { id: "1-3", title: "Primeras palabras", text: "sala falda salsa alas jalada alfalfa sala falda alas salsa jalada alfalfa" },
      { id: "1-4", title: "La g y la h", text: "haga hada gala gasa saga daga dada hasta gala hada haga gasa saga daga hasta" },
    ],
  },
  {
    id: 2,
    title: "Fila superior",
    description: "Subir desde la fila guía y volver a ella después de cada pulsación.",
    lessons: [
      { id: "2-1", title: "Teclas de índice y corazón", text: "frf juj ded kik frf juj ded kik rueda dedo jarra kilo fresa duro rifa" },
      { id: "2-2", title: "Todas las teclas", text: "sws lol aqa ñpñ tgt yhy qwer tyui opqw erty quiero pared tierra arroz" },
      { id: "2-3", title: "Palabras de dos filas", text: "pata sopa ropa tierra fruta agua leer reloj sorteo pirata tostada piedra jarra querer" },
    ],
  },
  {
    id: 3,
    title: "Fila inferior",
    description: "Bajar sin mover la muñeca. Incluye la coma, el punto y el guion.",
    lessons: [
      { id: "3-1", title: "Teclas básicas", text: "fvf jmj dcd k,k sxs l.l aza ñ-ñ fvf jmj dcd k,k sxs l.l aza" },
      { id: "3-2", title: "La b y la n", text: "fbf jnj fvbf jmnj bnb vmv cmc zxz banco nube cabo nombre vino mano" },
      { id: "3-3", title: "Palabras completas", text: "cambio, mesa, banco, vez, zona, nombre, examen, campo, manzana, cabeza, nevera, ventana." },
    ],
  },
  {
    id: 4,
    title: "Teclado numérico",
    description: "Mano derecha sobre el bloque numérico. El índice descansa en el 4 y el corazón en el 5.",
    lessons: [
      { id: "4-1", title: "Fila central", text: "456 465 546 564 645 654 44 55 66 456 654 465 546 564 645 456 654" },
      { id: "4-2", title: "Todas las cifras", text: "789 123 147 258 369 741 852 963 10 20 30 100 205 309 470 586 1024" },
      { id: "4-3", title: "Importes y fechas", text: "15,90 27240 08/11/2026 120,50 36201 3,75 28001 49,95 31/12/2026 0,99" },
    ],
  },
  {
    id: 5,
    title: "Mayúsculas, tildes y puntuación",
    description: "Texto real con mayúsculas, acentos y signos.",
    lessons: [
      { id: "5-1", title: "Mayúsculas", text: "Lugo, Ourense, Pontevedra y A Coruña son las cuatro provincias de Galicia." },
      { id: "5-2", title: "Tildes", text: "El técnico revisó la información del camión. Mañana habrá reunión a las diez en la oficina." },
      {
        id: "5-3",
        title: "Párrafo completo",
        text: "La grabación de datos exige atención y constancia. Antes de empezar, comprueba que la silla está a la altura correcta y que la pantalla queda frente a tus ojos. Coloca los dedos sobre la fila guía y no mires el teclado.",
      },
    ],
  },
  {
    id: 6,
    title: "Fichas de datos",
    description: "Registros como los de un puesto real: nombres, direcciones, teléfonos e importes.",
    lessons: [
      { id: "6-1", title: "Datos de cliente", text: "Nombre: Marta Losada Vázquez. Teléfono: 982 456 120. Código postal: 27002. Localidad: Lugo." },
      {
        id: "6-2",
        title: "Pedido",
        text: "Pedido 30418 del 08/11/2026: 2 jerséis a 49,90 euros y 1 bufanda a 29,00 euros. Total: 128,80 euros.",
      },
      {
        id: "6-3",
        title: "Ficha completa",
        text: "Cliente: Andrés Pena Rivas. Dirección: Rúa do Muíño, 14, 2.º B, 27002 Lugo. Teléfono: 982 451 778. Pago: transferencia. Observaciones: entregar de 16:00 a 20:00.",
      },
    ],
  },
];

export const ALL_LESSONS: Lesson[] = LEVELS.flatMap((l) => l.lessons);

export function findLesson(id: string): { lesson: Lesson; level: Level; index: number } | null {
  const index = ALL_LESSONS.findIndex((l) => l.id === id);
  if (index < 0) return null;
  const lesson = ALL_LESSONS[index];
  const level = LEVELS.find((lv) => lv.lessons.some((l) => l.id === id))!;
  return { lesson, level, index };
}

// Una leccion esta desbloqueada si es la primera o si la anterior esta superada.
export function isUnlocked(lessonId: string, completed: Set<string>): boolean {
  const found = findLesson(lessonId);
  if (!found) return false;
  if (found.index === 0) return true;
  return completed.has(ALL_LESSONS[found.index - 1].id);
}
