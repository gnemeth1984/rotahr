// @ts-nocheck
"use client";

/**
 * The course player: lessons → quiz → result.
 *
 * The correct answers are never in this file and never in the payload the page
 * receives. The paper comes down stripped, the signed token comes with it, and
 * the server grades the attempt. That is deliberate: the record this produces is
 * meant to survive somebody reading it in an inspection.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, GraduationCap, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Award, Info, Lightbulb, PenLine, Printer,
} from "lucide-react";
import { openCertificate } from "@/lib/training/certificate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function CourseInner() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get("slug") || "allergen-awareness";

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // "lessons" | "quiz" | "result"
  const [phase, setPhase] = useState<"lessons" | "quiz" | "result">("lessons");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const startedAt = useRef<string>(new Date().toISOString());
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/training/course?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          setSignedName(d.trainee?.name ?? "");
        }
        setLoading(false);
      })
      .catch(() => { setError("Could not load the course."); setLoading(false); });
  }, [slug]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, phase]);

  const lessons = data?.lessons ?? [];
  const questions = data?.questions ?? [];

  const answeredCount = useMemo(
    () => questions.filter((q: any) => (answers[q.id] ?? []).length > 0).length,
    [questions, answers]
  );

  // Fetches the filed record and opens the printable sheet. The sheet is built
  // from what the server says was filed, never from the state of this page, so
  // a printed record cannot disagree with the stored one.
  async function printRecord() {
    if (!result?.completionId) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const r = await fetch(
        `/api/training/certificate?id=${encodeURIComponent(result.completionId)}`
      );
      const d = await r.json();
      if (d.error) { setPrintError(d.error); return; }
      const ok = openCertificate({
        ...d.certificate,
        completedAt: d.certificate.completedAt,
        expiresAt: d.certificate.expiresAt,
      });
      if (!ok) {
        setPrintError(
          "Your browser blocked the print window. Allow pop-ups for rotahr.com and try again."
        );
      }
    } catch {
      setPrintError("Could not load the record. Try again in a moment.");
    } finally {
      setPrinting(false);
    }
  }

  function pick(q: any, idx: number) {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.kind === "single") return { ...prev, [q.id]: [idx] };
      return {
        ...prev,
        [q.id]: cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx].sort(),
      };
    });
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/training/course/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.token,
          answers,
          signedName,
          startedAt: startedAt.current,
        }),
      });
      const d = await res.json();
      if (d.error) setError(d.error);
      else { setResult(d); setPhase("result"); }
    } catch {
      setError("Could not submit the attempt.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" onClick={() => router.push("/training?tab=courses")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to training
        </Button>
        <Card><CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 text-slate-700">{error}</p>
        </CardContent></Card>
      </div>
    );
  }

  const course = data.course;

  return (
    <div className="mx-auto max-w-3xl space-y-5" ref={topRef}>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/training?tab=courses")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Training
        </Button>
        <Badge variant="outline" className="bg-slate-50 text-xs text-slate-500">
          In-house training · not an accredited qualification
        </Badge>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
          <GraduationCap className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
          <p className="text-sm text-slate-500">
            {phase === "lessons" && `Lesson ${step + 1} of ${lessons.length}`}
            {phase === "quiz" && `${questions.length} questions · pass mark ${course.passMark}%`}
            {phase === "result" && "Result"}
          </p>
        </div>
      </div>

      {/* Progress */}
      {phase !== "result" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{
              width:
                phase === "lessons"
                  ? `${((step + 1) / (lessons.length + 1)) * 100}%`
                  : "100%",
            }}
          />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data.practice && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Practice run.</strong> Your login isn&apos;t on the staff roster, so this
            attempt is marked but nothing is filed and no certificate is issued. Add yourself
            under Team if you want your own training record kept on file.
          </span>
        </div>
      )}

      {/* ---------------- Lessons ---------------- */}
      {phase === "lessons" && lessons[step] && (
        <>
          <Card><CardContent className="p-6">
            <h2 className="text-lg font-semibold text-slate-900">{lessons[step].title}</h2>
            <div className="mt-3 space-y-3">
              {lessons[step].body.map((p: string, i: number) => (
                <p key={i} className="text-[15px] leading-relaxed text-slate-700">{p}</p>
              ))}
            </div>

            {lessons[step].bullets?.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {lessons[step].bullets.map((b: string, i: number) => (
                  <li key={i} className="flex gap-2 text-[15px] text-slate-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {lessons[step].keyPoint && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                <p className="text-sm font-medium text-orange-900">{lessons[step].keyPoint}</p>
              </div>
            )}
          </CardContent></Card>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {step < lessons.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setPhase("quiz")}>
                Start the questions <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {lessons.map((l: any, i: number) => (
              <button
                key={l.id}
                onClick={() => setStep(i)}
                className={cn(
                  "h-1.5 w-8 rounded-full transition-colors",
                  i === step ? "bg-orange-500" : i < step ? "bg-orange-200" : "bg-slate-200"
                )}
                title={l.title}
              />
            ))}
          </div>
        </>
      )}

      {/* ---------------- Quiz ---------------- */}
      {phase === "quiz" && (
        <>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Answer every question. Some ask you to tick more than one option — those say so.
            You need {course.passMark}% to pass
            {data.practice
              ? ", and nothing is filed — this is a practice run."
              : ", and the record is filed either way."}
          </div>

          {questions.map((q: any, qi: number) => {
            const given = answers[q.id] ?? [];
            return (
              <Card key={q.id}><CardContent className="p-5">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {qi + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{q.prompt}</p>
                    {q.note && <p className="mt-1 text-sm text-slate-500">{q.note}</p>}
                    {q.kind === "multi" && (
                      <p className="mt-1 text-xs font-medium text-orange-600">
                        Tick everything that applies.
                      </p>
                    )}

                    <div className="mt-3 space-y-2">
                      {q.options.map((opt: string, oi: number) => {
                        const on = given.includes(oi);
                        return (
                          <button
                            key={oi}
                            onClick={() => pick(q, oi)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                              on
                                ? "border-orange-400 bg-orange-50 text-slate-900"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border",
                                q.kind === "multi" ? "rounded" : "rounded-full",
                                on ? "border-orange-500 bg-orange-500" : "border-slate-300 bg-white"
                              )}
                            >
                              {on && <CheckCircle2 className="h-3 w-3 text-white" />}
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent></Card>
            );
          })}

          <Card><CardContent className="p-5">
            <div className="flex items-start gap-3">
              <PenLine className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              <div className="flex-1">
                <Label htmlFor="sign" className="text-sm font-medium text-slate-800">
                  Sign the record
                </Label>
                <p className="mt-1 text-xs text-slate-500">
                  Type your full name. This is what appears on the training record kept for
                  your venue, alongside the date and your score.
                </p>
                <Input
                  id="sign"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  placeholder="Your full name"
                  className="mt-2 max-w-sm"
                />
              </div>
            </div>
          </CardContent></Card>

          <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
            <Button variant="outline" onClick={() => setPhase("lessons")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to the lessons
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {answeredCount} of {questions.length} answered
              </span>
              <Button
                disabled={submitting || answeredCount < questions.length || signedName.trim().length < 3}
                onClick={submit}
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Marking...</>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ---------------- Result ---------------- */}
      {phase === "result" && result && (
        <>
          <Card className={cn(
            "border-2",
            result.passed ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40"
          )}>
            <CardContent className="p-6 text-center">
              {result.passed ? (
                <Award className="mx-auto h-10 w-10 text-green-600" />
              ) : (
                <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
              )}
              <h2 className="mt-3 text-xl font-bold text-slate-900">
                {result.passed ? "Passed" : "Not passed this time"}
              </h2>
              <p className="mt-1 text-slate-600">
                {result.score} of {result.total} correct ({result.percent}%) · pass mark{" "}
                {result.passMark}%
              </p>
              {result.filed === false ? (
                <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                  This was a practice run, so nothing has been filed and no certificate was
                  issued. Read the explanations below. To keep a real record, add yourself to the
                  team roster and take it again.
                </p>
              ) : result.passed ? (
                <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                  A dated training record has been filed against you and a certificate added to
                  the tracker, valid until{" "}
                  <strong>
                    {new Date(result.expiresAt).toLocaleDateString("en-IE", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </strong>
                  . You will be reminded before it expires.
                </p>
              ) : (
                <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                  The attempt has been recorded. Read the explanations below, then take it again —
                  there is no limit on attempts.
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => router.push("/training?tab=courses")}>
                  Back to courses
                </Button>
                {result.passed && result.filed !== false && result.completionId && (
                  <Button onClick={printRecord} disabled={printing}>
                    {printing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="mr-2 h-4 w-4" />
                    )}
                    Print record
                  </Button>
                )}
                {!result.passed && (
                  <Button onClick={() => window.location.reload()}>Take it again</Button>
                )}
              </div>
              {printError && (
                <p className="mt-3 text-sm text-amber-700">{printError}</p>
              )}
            </CardContent>
          </Card>

          <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Every answer, and why
          </h3>

          {result.detail.map((d: any, i: number) => (
            <Card key={d.id}><CardContent className="p-5">
              <div className="flex gap-3">
                {d.right ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{i + 1}. {d.prompt}</p>
                  <div className="mt-2 space-y-1.5">
                    {d.options.map((opt: string, oi: number) => {
                      const isCorrect = d.correct.includes(oi);
                      const wasGiven = d.given.includes(oi);
                      return (
                        <div
                          key={oi}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-sm",
                            isCorrect && "border-green-300 bg-green-50 text-green-900",
                            !isCorrect && wasGiven && "border-red-300 bg-red-50 text-red-900",
                            !isCorrect && !wasGiven && "border-slate-200 text-slate-500"
                          )}
                        >
                          {opt}
                          {isCorrect && <span className="ml-2 text-xs font-medium">correct</span>}
                          {!isCorrect && wasGiven && (
                            <span className="ml-2 text-xs font-medium">you chose this</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <p className="text-sm text-slate-600">{d.why}</p>
                  </div>
                </div>
              </div>
            </CardContent></Card>
          ))}
          <div className="pb-8" />
        </>
      )}
    </div>
  );
}

export default function CoursePage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    }>
      <CourseInner />
    </Suspense>
  );
}
