"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { endTeacherSession, requireTeacher, requireTeacherClass, startTeacherSession } from "@/lib/session";
import { madridLocalToIso, newClassCode, newPin, slugifyName, uniqueAlias } from "@/lib/utils";
import { findForm } from "@/lib/forms";
import { testHasActivity } from "@/lib/tests";

export type FormState = { error?: string; ok?: string };

// ---------- Acceso ----------

export async function setupTeacher(_prev: FormState, form: FormData): Promise<FormState> {
  const { count } = await db().from("teachers").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { error: "Ya existe una cuenta de profesor. Inicia sesión." };
  const setupCode = process.env.SETUP_CODE;
  if (!setupCode) return { error: "Falta la variable SETUP_CODE en Vercel." };
  if (String(form.get("setup") ?? "") !== setupCode) return { error: "Código de alta incorrecto." };
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || !email.includes("@")) return { error: "Revisa el nombre y el email." };
  if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };
  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await db().from("teachers").insert({ name, email, password_hash }).select("id").single();
  if (error || !data) {
    console.error("setupTeacher", error);
    return { error: `No se pudo crear la cuenta: ${error?.message ?? "sin respuesta de la base de datos"}` };
  }
  await startTeacherSession(data.id);
  redirect("/profesor");
}

export async function loginTeacher(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const { data } = await db().from("teachers").select("id,password_hash").eq("email", email).maybeSingle();
  let ok = false;
  try {
    ok = !!data && (await bcrypt.compare(password, data.password_hash));
  } catch {
    ok = false;
  }
  if (!data || !ok) return { error: "Email o contraseña incorrectos." };
  await startTeacherSession(data.id);
  redirect("/profesor");
}

export async function logoutTeacher() {
  await endTeacherSession();
  redirect("/profesor/acceso");
}

// ---------- Clases ----------

export async function createClass(_prev: FormState, form: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Pon un nombre a la clase." };
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db()
      .from("classes")
      .insert({ teacher_id: teacher.id, name, code: newClassCode() })
      .select("id")
      .single();
    if (!error && data) redirect(`/profesor/clase/${data.id}?tab=alumnos`);
  }
  return { error: "No se pudo crear la clase. Vuelve a intentarlo." };
}

export async function updateBaremo(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(",", "."));
  const baremo = { min5: num("min5"), max10: num("max10"), minAcc: num("minAcc"), penalty: num("penalty") };
  if (Object.values(baremo).some((v) => !Number.isFinite(v) || v < 0)) return { error: "Revisa los valores: deben ser números positivos." };
  if (baremo.max10 <= baremo.min5) return { error: "Las netas para el 10 deben ser mayores que las del 5." };
  if (baremo.minAcc > 100) return { error: "La precisión mínima no puede pasar del 100 %." };
  await db().from("classes").update({ baremo }).eq("id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
  return { ok: "Baremo guardado. Las notas se han recalculado." };
}

// ---------- Alumnos ----------

export async function addStudents(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const names = String(form.get("names") ?? "")
    .split(/\r?\n/)
    .map((n) => n.trim().replace(/\s+/g, " "))
    .filter((n) => n.length >= 2)
    .slice(0, 100);
  if (names.length === 0) return { error: "Escribe un nombre completo por línea." };

  const { data: existing } = await db().from("students").select("username,alias").eq("class_id", classId);
  const taken = new Set((existing ?? []).map((s) => s.username as string));
  const aliases = new Set((existing ?? []).map((s) => String(s.alias).toLowerCase()));
  const rows = names.map((full_name) => {
    const base = slugifyName(full_name);
    let username = base;
    let i = 2;
    while (taken.has(username)) username = `${base}${i++}`;
    taken.add(username);
    const alias = uniqueAlias(full_name, aliases);
    aliases.add(alias.toLowerCase());
    return { class_id: classId, full_name, username, alias, pin: newPin() };
  });
  const { error } = await db().from("students").insert(rows);
  if (error) return { error: "No se pudieron dar de alta los alumnos." };
  revalidatePath(`/profesor/clase/${classId}`);
  return { ok: `${rows.length} ${rows.length === 1 ? "alumno dado" : "alumnos dados"} de alta. Imprime las tarjetas para repartir los accesos.` };
}

export async function resetPin(classId: string, studentId: string) {
  await requireTeacherClass(classId);
  await db().from("students").update({ pin: newPin(), failed_logins: 0 }).eq("id", studentId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
}

export async function deleteStudent(classId: string, studentId: string) {
  await requireTeacherClass(classId);
  await db().from("students").delete().eq("id", studentId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
}

// ---------- Pruebas ----------

type ParsedTest = { title: string; content: string; duration_sec: number | null; max_attempts: number | null; opens_at: string; closes_at: string };

function parseTestForm(form: FormData): ParsedTest | { error: string } {
  const title = String(form.get("title") ?? "").trim();
  const kind = String(form.get("kind") ?? "texto");
  const formId = String(form.get("form_id") ?? "");
  const content =
    kind === "formulario"
      ? `form:${formId}`
      : String(form.get("content") ?? "")
          .normalize("NFC")
          .replace(/\r?\n+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
  const timeMode = String(form.get("time_mode") ?? "limit");
  const durationMin = Number(String(form.get("duration") ?? "").replace(",", "."));
  const attemptsMode = String(form.get("attempts_mode") ?? "free");
  const maxAttempts = Math.floor(Number(form.get("max_attempts") ?? ""));
  const opens = String(form.get("opens") ?? "");
  const closes = String(form.get("closes") ?? "");
  if (!title) return { error: "Pon un título a la prueba." };
  if (kind === "formulario" && !findForm(formId)) return { error: "Elige un formulario." };
  if (kind !== "formulario" && content.length < 50) return { error: "El texto debe tener al menos 50 caracteres." };
  if (timeMode !== "free" && (!Number.isFinite(durationMin) || durationMin < 0.5 || durationMin > 180))
    return { error: "La duración debe estar entre 0,5 y 180 minutos." };
  if (attemptsMode === "exam" && (!Number.isFinite(maxAttempts) || maxAttempts < 1 || maxAttempts > 20))
    return { error: "El número de intentos debe estar entre 1 y 20." };
  if (!opens || !closes) return { error: "Indica cuándo se abre y cuándo se cierra." };
  const opens_at = madridLocalToIso(opens);
  const closes_at = madridLocalToIso(closes);
  if (Date.parse(closes_at) <= Date.parse(opens_at)) return { error: "El cierre debe ser posterior a la apertura." };
  return {
    title,
    content,
    duration_sec: timeMode === "free" ? null : Math.round(durationMin * 60),
    max_attempts: attemptsMode === "exam" ? maxAttempts : null,
    opens_at,
    closes_at,
  };
}

export async function createTest(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const parsed = parseTestForm(form);
  if ("error" in parsed) return parsed;
  const { error } = await db().from("tests").insert({ class_id: classId, ...parsed });
  if (error) {
    console.error("createTest", error);
    return { error: "No se pudo crear la prueba. Si acabas de actualizar la app, comprueba que ejecutaste supabase/migracion-4.sql en Supabase." };
  }
  revalidatePath(`/profesor/clase/${classId}`);
  return { ok: "Prueba creada." };
}

export async function updateTest(classId: string, testId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const { data: current } = await db().from("tests").select("*").eq("id", testId).eq("class_id", classId).maybeSingle();
  if (!current) return { error: "Prueba no encontrada." };
  const locked = await testHasActivity(testId);
  if (locked) {
    // Se conservan el texto y la duracion actuales
    form.set("kind", String(current.content).startsWith("form:") ? "formulario" : "texto");
    form.set("form_id", String(current.content).startsWith("form:") ? String(current.content).slice(5) : "");
    form.set("content", String(current.content));
    form.set("time_mode", current.duration_sec === null ? "free" : "limit");
    form.set("duration", String((current.duration_sec ?? 300) / 60));
  }
  const parsed = parseTestForm(form);
  if ("error" in parsed) return parsed;
  const { error } = await db().from("tests").update(parsed).eq("id", testId).eq("class_id", classId);
  if (error) {
    console.error("updateTest", error);
    return { error: "No se pudieron guardar los cambios. Si acabas de actualizar la app, comprueba que ejecutaste supabase/migracion-4.sql en Supabase." };
  }
  revalidatePath(`/profesor/clase/${classId}`);
  return { ok: locked ? "Cambios guardados. El texto y el tiempo no se han tocado porque ya hay alumnos que la han hecho." : "Cambios guardados." };
}

// ---------- Clase y alumnos: edicion ----------

export async function renameClass(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Pon un nombre a la clase." };
  await db().from("classes").update({ name }).eq("id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
  revalidatePath("/profesor");
  return { ok: "Nombre guardado." };
}

export async function updateStudent(classId: string, studentId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const full_name = String(form.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const alias = String(form.get("alias") ?? "").trim().replace(/\s+/g, " ");
  if (full_name.length < 2) return { error: "Escribe el nombre completo." };
  if (alias.length < 2 || alias.length > 20) return { error: "El alias debe tener entre 2 y 20 caracteres." };
  const { data: same } = await db().from("students").select("id").eq("class_id", classId).ilike("alias", alias.replace(/[%_]/g, "\\$&")).neq("id", studentId);
  if (same && same.length) return { error: "Ese alias ya lo usa otro alumno de la clase." };
  await db().from("students").update({ full_name, alias }).eq("id", studentId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
  return { ok: "Alumno actualizado. Su usuario y su PIN no cambian." };
}

export async function closeTestNow(classId: string, testId: string) {
  await requireTeacherClass(classId);
  await db().from("tests").update({ closes_at: new Date().toISOString() }).eq("id", testId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
}

export async function deleteTest(classId: string, testId: string) {
  await requireTeacherClass(classId);
  await db().from("tests").delete().eq("id", testId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
  redirect(`/profesor/clase/${classId}?tab=pruebas`);
}

export async function allowRetake(classId: string, testId: string, studentId: string) {
  await requireTeacherClass(classId);
  await db().from("attempts").delete().eq("test_id", testId).eq("student_id", studentId).eq("class_id", classId).eq("mode", "prueba");
  await db().from("test_sessions").delete().eq("test_id", testId).eq("student_id", studentId);
  // Reinicia los intentos de ese alumno en esta prueba (se borran sus entregas)
  revalidatePath(`/profesor/clase/${classId}`);
  redirect(`/profesor/clase/${classId}?tab=resultados&prueba=${testId}`);
}

export async function validateAttempt(classId: string, attemptId: string) {
  await requireTeacherClass(classId);
  await db().from("attempts").update({ flagged: false }).eq("id", attemptId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
}
