import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export type ClassRow = {
  id: string;
  teacher_id: string;
  name: string;
  code: string;
  baremo: import("./scoring").Baremo;
  created_at: string;
};

export type StudentRow = {
  id: string;
  class_id: string;
  full_name: string;
  username: string;
  alias: string;
  pin: string;
  failed_logins: number;
  last_seen_at: string | null;
  created_at: string;
};

export type TestRow = {
  id: string;
  class_id: string;
  title: string;
  content: string;
  duration_sec: number;
  opens_at: string;
  closes_at: string;
  created_at: string;
};

export type AttemptRow = {
  id: string;
  student_id: string;
  class_id: string;
  mode: "practica" | "prueba" | "carrera";
  lesson_id: string | null;
  test_id: string | null;
  chars: number;
  errors: number;
  duration_ms: number;
  gross_ppm: number;
  net_ppm: number;
  accuracy: number;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
};
