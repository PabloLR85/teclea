import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, type ClassRow, type StudentRow } from "./db";

const STUDENT_COOKIE = "teclea_alumno";
const TEACHER_COOKIE = "teclea_profe";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
}

async function setCookie(name: string, payload: Record<string, string>, days: number) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: days * 86400,
  });
}

async function readCookie(name: string): Promise<Record<string, unknown> | null> {
  const jar = await cookies();
  const token = jar.get(name)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function startStudentSession(studentId: string) {
  await setCookie(STUDENT_COOKIE, { sid: studentId }, 30);
}

export async function startTeacherSession(teacherId: string) {
  await setCookie(TEACHER_COOKIE, { tid: teacherId }, 7);
}

export async function endStudentSession() {
  (await cookies()).delete(STUDENT_COOKIE);
}

export async function endTeacherSession() {
  (await cookies()).delete(TEACHER_COOKIE);
}

export type StudentCtx = { student: StudentRow; klass: ClassRow };

export async function getStudent(): Promise<StudentCtx | null> {
  const p = await readCookie(STUDENT_COOKIE);
  if (!p || typeof p.sid !== "string") return null;
  const { data: student } = await db().from("students").select("*").eq("id", p.sid).maybeSingle();
  if (!student) return null;
  const { data: klass } = await db().from("classes").select("*").eq("id", student.class_id).maybeSingle();
  if (!klass) return null;
  return { student: student as StudentRow, klass: klass as ClassRow };
}

export async function requireStudent(): Promise<StudentCtx> {
  const ctx = await getStudent();
  if (!ctx) redirect("/");
  return ctx;
}

export type TeacherRow = { id: string; email: string; name: string };

export async function getTeacher(): Promise<TeacherRow | null> {
  const p = await readCookie(TEACHER_COOKIE);
  if (!p || typeof p.tid !== "string") return null;
  const { data } = await db().from("teachers").select("id,email,name").eq("id", p.tid).maybeSingle();
  return (data as TeacherRow) ?? null;
}

export async function requireTeacher(): Promise<TeacherRow> {
  const t = await getTeacher();
  if (!t) redirect("/profesor/acceso");
  return t;
}

export async function requireTeacherClass(classId: string): Promise<{ teacher: TeacherRow; klass: ClassRow }> {
  const teacher = await requireTeacher();
  const { data } = await db().from("classes").select("*").eq("id", classId).eq("teacher_id", teacher.id).maybeSingle();
  if (!data) redirect("/profesor");
  return { teacher, klass: data as ClassRow };
}
