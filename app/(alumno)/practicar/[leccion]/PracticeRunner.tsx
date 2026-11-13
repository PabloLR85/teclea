"use client";

import { TypingExercise } from "@/components/TypingExercise";
import { submitPractice } from "@/app/actions/alumno";

export function PracticeRunner({ lessonId, text, nextHref, penalty }: { lessonId: string; text: string; nextHref: string | null; penalty: number }) {
  return (
    <TypingExercise
      key={lessonId}
      target={text}
      mode="practica"
      onSubmit={(p) => submitPractice(lessonId, p)}
      nextHref={nextHref}
      backHref="/practicar"
      penalty={penalty}
    />
  );
}
