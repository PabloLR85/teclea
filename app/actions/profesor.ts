"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { endTeacherSession, requireTeacher, requireTeacherClass, startTeacherSession } from "@/lib/session";
import { defaultAlias, madridLocalToIso, newClassCode, newPin, slugifyName } from "@/lib/utils";

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

  const { data: existing } = await db().from("students").select("username").eq("class_id", classId);
  const taken = new Set((existing ?? []).map((s) => s.username as string));
  const rows = names.map((full_name) => {
    const base = slugifyName(full_name);
    let username = base;
    let i = 2;
    while (taken.has(username)) username = `${base}${i++}`;
    taken.add(username);
    return { class_id: classId, full_name, username, alias: defaultAlias(full_name), pin: newPin() };
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

export async function createTest(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const durationMin = Number(String(form.get("duration") ?? "").replace(",", "."));
  const opens = String(form.get("opens") ?? "");
  const closes = String(form.get("closes") ?? "");
  if (!title) return { error: "Pon un título a la prueba." };
  if (content.length < 50) return { error: "El texto debe tener al menos 50 caracteres." };
  if (!Number.isFinite(durationMin) || durationMin < 0.5 || durationMin > 30) return { error: "La duración debe estar entre 0,5 y 30 minutos." };
  if (!opens || !closes) return { error: "Indica cuándo se abre y cuándo se cierra." };
  const opens_at = madridLocalToIso(opens);
  const closes_at = madridLocalToIso(closes);
  if (Date.parse(closes_at) <= Date.parse(opens_at)) return { error: "El cierre debe ser posterior a la apertura." };
  const { error } = await db()
    .from("tests")
    .insert({ class_id: classId, title, content, duration_sec: Math.round(durationMin * 60), opens_at, closes_at });
  if (error) return { error: "No se pudo crear la prueba." };
  revalidatePath(`/profesor/clase/${classId}`);
  return { ok: "Prueba creada." };
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
  revalidatePath(`/profesor/clase/${classId}`);
}

export async function validateAttempt(classId: string, attemptId: string) {
  await requireTeacherClass(classId);
  await db().from("attempts").update({ flagged: false }).eq("id", attemptId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
}
