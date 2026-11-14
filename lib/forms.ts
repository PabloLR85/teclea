import { align } from "./scoring";

// Ejercicios de formulario: el alumno lee un documento (izquierda) y rellena el formulario (derecha).
// Todos los datos son ficticios.

export type FormField = { key: string; label: string; numeric?: boolean; wide?: boolean };
export type FormRecord = Record<string, string>;
export type FormTemplate = {
  id: string;
  title: string;
  description: string;
  docTitle: string;
  fields: FormField[];
  records: FormRecord[];
  doc: (r: FormRecord) => string[];
};

const eur = (n: number) => n.toFixed(2).replace(".", ",");

// ---------- Datos ----------

const CLIENTES: [string, string, string, string, string, string, string, string][] = [
  ["Marta", "Losada Vázquez", "33456721K", "Rúa do Muíño, 14, 2.º B", "27002", "Lugo", "982456120", "marta.losada@correo.example"],
  ["Andrés", "Pena Rivas", "76543218M", "Avenida da Coruña, 112, 1.º A", "27003", "Lugo", "982451778", "andres.pena@correo.example"],
  ["Lucía", "Varela Souto", "44128903P", "Calle Real, 7", "15003", "A Coruña", "981203344", "lvarela@correo.example"],
  ["Xoán", "Fernández Lago", "32987650T", "Praza Maior, 3, bajo", "27400", "Monforte de Lemos", "982401255", "xoan.fdez@correo.example"],
  ["Carmen", "Rodríguez Pérez", "53210876R", "Calle del Progreso, 45, 3.º C", "32005", "Ourense", "988224610", "carmen.rp@correo.example"],
  ["Iago", "Castro Méndez", "47801234H", "Rúa Nova, 21", "36202", "Vigo", "986431987", "iago.castro@correo.example"],
  ["Noelia", "Gómez Arias", "35612987S", "Avenida de Madrid, 88, 4.º D", "27002", "Lugo", "982215643", "noelia.gomez@correo.example"],
  ["Manuel", "Díaz Otero", "33019845B", "Camiño Vello, 5", "27800", "Vilalba", "982510342", "manu.diaz@correo.example"],
];

const PEDIDOS: [string, string, string, string, string, number, number][] = [
  ["30418", "08/11/2026", "Marta Losada Vázquez", "JR-2041", "Jersey de lana gris", 2, 49.9],
  ["30419", "09/11/2026", "Andrés Pena Rivas", "AB-1187", "Abrigo de paño azul", 1, 159],
  ["30420", "09/11/2026", "Lucía Varela Souto", "BF-0032", "Bufanda de punto", 3, 29],
  ["30421", "10/11/2026", "Xoán Fernández Lago", "CM-5520", "Camisa de algodón blanca", 4, 35.5],
  ["30422", "10/11/2026", "Carmen Rodríguez Pérez", "PT-3310", "Pantalón chino beige", 2, 45.95],
  ["30423", "11/11/2026", "Iago Castro Méndez", "ZP-7781", "Zapatillas de piel", 1, 89.9],
  ["30424", "12/11/2026", "Noelia Gómez Arias", "CZ-0915", "Calcetines térmicos", 6, 6.5],
  ["30425", "12/11/2026", "Manuel Díaz Otero", "CH-4402", "Chaqueta impermeable", 1, 119],
];

const FACTURAS: [string, string, string, string, number][] = [
  ["Textiles do Norte S.L.", "B27123456", "FN-2026-0412", "02/11/2026", 1250],
  ["Calzados Miño S.A.", "A32654321", "2026/1187", "03/11/2026", 864.3],
  ["Hilaturas Atlánticas S.L.", "B15987654", "HA-0933", "04/11/2026", 432.75],
  ["Embalajes Lucenses S.L.", "B27456789", "E-26-0251", "05/11/2026", 96.4],
  ["Transportes Ribeira S.L.", "B36741258", "TR-11873", "06/11/2026", 215],
  ["Papelería Central C.B.", "E27369852", "PC-0078", "09/11/2026", 58.25],
  ["Limpiezas Brillo S.L.", "B27852147", "LB-2026-310", "10/11/2026", 180],
  ["Electricidad Sar S.L.", "B15258369", "ES-4471", "11/11/2026", 327.6],
];

const ENCUESTAS: [string, string, string, string, string, string][] = [
  ["03/11/2026", "Lugo", "34", "4", "Sí", "Buena atención, aunque tuve que esperar en caja."],
  ["03/11/2026", "Lugo", "52", "5", "Sí", "Muy amables y encontré mi talla a la primera."],
  ["04/11/2026", "Ourense", "27", "3", "No", "Poca variedad en la sección de calzado."],
  ["05/11/2026", "Vigo", "61", "5", "Sí", "Me ayudaron a elegir un regalo. Volveré."],
  ["06/11/2026", "A Coruña", "45", "2", "No", "El pedido llegó con dos días de retraso."],
  ["07/11/2026", "Lugo", "19", "4", "Sí", "Precios correctos y buena música en la tienda."],
  ["10/11/2026", "Monforte de Lemos", "38", "4", "Sí", "El cambio de talla fue rápido y sin problemas."],
  ["11/11/2026", "Vilalba", "70", "5", "Sí", "Trato excelente de principio a fin."],
];

const INVENTARIO: [string, string, string, string, string][] = [
  ["JR-2041", "Jersey de lana gris", "A-03-2", "14", "49,90"],
  ["AB-1187", "Abrigo de paño azul", "B-01-4", "6", "159,00"],
  ["BF-0032", "Bufanda de punto", "A-07-1", "32", "29,00"],
  ["CM-5520", "Camisa de algodón blanca", "C-02-3", "21", "35,50"],
  ["PT-3310", "Pantalón chino beige", "C-05-1", "18", "45,95"],
  ["ZP-7781", "Zapatillas de piel", "D-01-2", "9", "89,90"],
  ["CZ-0915", "Calcetines térmicos", "A-09-4", "120", "6,50"],
  ["CH-4402", "Chaqueta impermeable", "B-04-3", "7", "119,00"],
];

// ---------- Plantillas ----------

export const FORMS: FormTemplate[] = [
  {
    id: "cliente",
    title: "Alta de cliente",
    description: "Solicitudes escritas por clientes. Localiza cada dato en el texto y pásalo a su campo.",
    docTitle: "Solicitud de alta",
    fields: [
      { key: "nombre", label: "Nombre" },
      { key: "apellidos", label: "Apellidos" },
      { key: "nif", label: "NIF" },
      { key: "direccion", label: "Dirección", wide: true },
      { key: "cp", label: "Código postal", numeric: true },
      { key: "localidad", label: "Localidad" },
      { key: "telefono", label: "Teléfono", numeric: true },
      { key: "email", label: "Correo electrónico", wide: true },
    ],
    records: CLIENTES.map(([nombre, apellidos, nif, direccion, cp, localidad, telefono, email]) => ({
      nombre, apellidos, nif, direccion, cp, localidad, telefono, email,
    })),
    doc: (r) => [
      `Yo, ${r.nombre} ${r.apellidos}, con NIF ${r.nif}, solicito darme de alta como cliente.`,
      `Mi domicilio es ${r.direccion}, ${r.cp} ${r.localidad}.`,
      `Podéis contactar conmigo en el teléfono ${r.telefono} o en el correo ${r.email}.`,
    ],
  },
  {
    id: "pedido",
    title: "Pedido de cliente",
    description: "Hojas de pedido. Copia los datos y fíjate bien en referencias e importes.",
    docTitle: "Hoja de pedido",
    fields: [
      { key: "numero", label: "Nº de pedido", numeric: true },
      { key: "fecha", label: "Fecha", numeric: true },
      { key: "cliente", label: "Cliente", wide: true },
      { key: "referencia", label: "Referencia" },
      { key: "descripcion", label: "Descripción", wide: true },
      { key: "cantidad", label: "Unidades", numeric: true },
      { key: "precio", label: "Precio unidad (€)", numeric: true },
      { key: "total", label: "Total (€)", numeric: true },
    ],
    records: PEDIDOS.map(([numero, fecha, cliente, referencia, descripcion, cantidad, precio]) => ({
      numero, fecha, cliente, referencia, descripcion, cantidad: String(cantidad), precio: eur(precio), total: eur(cantidad * precio),
    })),
    doc: (r) => [
      `PEDIDO Nº ${r.numero}`,
      `Fecha: ${r.fecha}`,
      `Cliente: ${r.cliente}`,
      `Artículo: ${r.descripcion} (ref. ${r.referencia})`,
      `Unidades: ${r.cantidad}   Precio por unidad: ${r.precio} €`,
      `TOTAL PEDIDO: ${r.total} €`,
    ],
  },
  {
    id: "factura",
    title: "Factura de proveedor",
    description: "Facturas recibidas. Graba los datos fiscales y los importes exactos.",
    docTitle: "Factura",
    fields: [
      { key: "proveedor", label: "Proveedor", wide: true },
      { key: "cif", label: "CIF" },
      { key: "numero", label: "Nº de factura" },
      { key: "fecha", label: "Fecha", numeric: true },
      { key: "base", label: "Base imponible (€)", numeric: true },
      { key: "iva", label: "IVA 21 % (€)", numeric: true },
      { key: "total", label: "Total (€)", numeric: true },
    ],
    records: FACTURAS.map(([proveedor, cif, numero, fecha, base]) => {
      const iva = Math.round(base * 21) / 100;
      return { proveedor, cif, numero, fecha, base: eur(base), iva: eur(iva), total: eur(base + iva) };
    }),
    doc: (r) => [
      r.proveedor.toUpperCase(),
      `CIF: ${r.cif}`,
      `Factura nº ${r.numero} · Fecha de emisión ${r.fecha}`,
      `Base imponible: ${r.base} €`,
      `IVA (21 %): ${r.iva} €`,
      `TOTAL A PAGAR: ${r.total} €`,
    ],
  },
  {
    id: "encuesta",
    title: "Encuesta de satisfacción",
    description: "Encuestas en papel. Incluye un comentario libre que hay que copiar tal cual.",
    docTitle: "Encuesta",
    fields: [
      { key: "fecha", label: "Fecha", numeric: true },
      { key: "localidad", label: "Localidad" },
      { key: "edad", label: "Edad", numeric: true },
      { key: "valoracion", label: "Valoración (1-5)", numeric: true },
      { key: "recomienda", label: "¿Recomendaría? (Sí/No)" },
      { key: "comentario", label: "Comentario", wide: true },
    ],
    records: ENCUESTAS.map(([fecha, localidad, edad, valoracion, recomienda, comentario]) => ({
      fecha, localidad, edad, valoracion, recomienda, comentario,
    })),
    doc: (r) => [
      `Encuesta recogida el ${r.fecha} en la tienda de ${r.localidad}.`,
      `Edad de la persona: ${r.edad} años.`,
      `Valoración del servicio, de 1 a 5: ${r.valoracion}`,
      `¿Nos recomendaría a un amigo? ${r.recomienda}`,
      `Comentario: ${r.comentario}`,
    ],
  },
  {
    id: "inventario",
    title: "Recuento de inventario",
    description: "Notas del recuento de almacén. Mucho dato numérico y códigos de ubicación.",
    docTitle: "Nota de recuento",
    fields: [
      { key: "referencia", label: "Referencia" },
      { key: "descripcion", label: "Artículo", wide: true },
      { key: "ubicacion", label: "Ubicación" },
      { key: "unidades", label: "Unidades", numeric: true },
      { key: "precio", label: "PVP (€)", numeric: true },
    ],
    records: INVENTARIO.map(([referencia, descripcion, ubicacion, unidades, precio]) => ({
      referencia, descripcion, ubicacion, unidades, precio,
    })),
    doc: (r) => [
      `Estantería ${r.ubicacion}: contadas ${r.unidades} unidades.`,
      `Artículo: ${r.descripcion}, referencia ${r.referencia}.`,
      `Precio de venta marcado en la etiqueta: ${r.precio} €.`,
    ],
  },
];

export function findForm(id: string): FormTemplate | null {
  return FORMS.find((f) => f.id === id) ?? null;
}

// Registros que se usan en la practica (en las pruebas y carreras se usan todos).
export const PRACTICE_RECORDS = 3;

// ---------- Puntuacion ----------

export type FormAnswers = FormRecord[];

// Errores de un campo: distancia de edicion completa (lo que falte al final tambien cuenta).
export function fieldErrors(expected: string, typed: string): number {
  if (!typed) return expected.length;
  const a = align(expected, typed);
  return a.errors + (expected.length - a.consumed);
}

export type FormScoreDetail = { record: number; key: string; expected: string; typed: string; errors: number };

// Cuentan todos los campos de los registros enviados y, del registro en curso, solo los campos ya escritos.
export function scoreForm(t: FormTemplate, answers: FormAnswers, submitted: number, recordLimit = t.records.length) {
  let chars = 0;
  let errors = 0;
  const detail: FormScoreDetail[] = [];
  const n = Math.min(answers.length, recordLimit, t.records.length);
  for (let r = 0; r < n; r++) {
    for (const f of t.fields) {
      const typed = String(answers[r]?.[f.key] ?? "").slice(0, 200);
      const expected = t.records[r][f.key];
      if (r < submitted || typed.length > 0) {
        const e = fieldErrors(expected, typed);
        chars += typed.length;
        errors += e;
        detail.push({ record: r, key: f.key, expected, typed, errors: e });
      }
    }
  }
  return { chars, errors, detail };
}

// Formato en que se guarda lo escrito en un intento de formulario
export type StoredForm = { form: string; answers: FormAnswers; submitted: number };

export function parseStoredForm(typed: string | null): StoredForm | null {
  if (!typed || !typed.startsWith('{"form"')) return null;
  try {
    const v = JSON.parse(typed) as StoredForm;
    return v && typeof v.form === "string" && Array.isArray(v.answers) ? v : null;
  } catch {
    return null;
  }
}
