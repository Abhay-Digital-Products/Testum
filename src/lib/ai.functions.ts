import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ attemptId: z.string().uuid() });

export const generateAiAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: attempt, error: attErr } = await supabase
      .from("attempts")
      .select("id, user_id, score, correct_count, wrong_count, unattempted_count, time_spent_seconds, test_id, tests(title, total_questions, marks_correct, marks_wrong, duration_minutes)")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (attErr || !attempt) throw new Error("Attempt not found");
    if (attempt.user_id !== userId) throw new Error("Forbidden");

    // Fetch all student answers with associated question details from Supabase
    const { data: answers } = await supabase
      .from("answers")
      .select("is_correct, time_spent_seconds, question_id, questions(subject, chapter, question_text, correct_option)")
      .eq("attempt_id", data.attemptId);

    // Build subject and chapter statistics
    type Stat = { total: number; correct: number; wrong: number; unattempted: number; timeSpent: number };
    const bySubject: Record<string, Stat> = {};
    const byChapter: Record<string, Stat> = {};

    for (const a of answers ?? []) {
      const q: any = a.questions;
      const s = (q?.subject ?? "general").toLowerCase();
      const c = q?.chapter || "General Revision";
      const time = Number(a.time_spent_seconds || 0);

      bySubject[s] ??= { total: 0, correct: 0, wrong: 0, unattempted: 0, timeSpent: 0 };
      byChapter[c] ??= { total: 0, correct: 0, wrong: 0, unattempted: 0, timeSpent: 0 };

      bySubject[s].total++;
      byChapter[c].total++;
      bySubject[s].timeSpent += time;
      byChapter[c].timeSpent += time;

      if (a.is_correct === true) {
        bySubject[s].correct++;
        byChapter[c].correct++;
      } else if (a.is_correct === false) {
        bySubject[s].wrong++;
        byChapter[c].wrong++;
      } else {
        bySubject[s].unattempted++;
        byChapter[c].unattempted++;
      }
    }

    // Rank chapters by accuracy
    const chapterEntries = Object.entries(byChapter);
    const sortedWeakToStrong = [...chapterEntries].sort((a, b) => {
      const accA = a[1].total ? (a[1].correct / a[1].total) : 0;
      const accB = b[1].total ? (b[1].correct / b[1].total) : 0;
      return accA - accB;
    });

    const weak_topics = sortedWeakToStrong
      .filter(([_, s]) => s.total > 0 && (s.correct / s.total) < 0.7)
      .slice(0, 6)
      .map(([name]) => name);

    const strong_topics = [...sortedWeakToStrong]
      .reverse()
      .filter(([_, s]) => s.total > 0 && (s.correct / s.total) >= 0.7)
      .slice(0, 6)
      .map(([name]) => name);

    if (weak_topics.length === 0 && chapterEntries.length > 0) {
      weak_topics.push(sortedWeakToStrong[0][0]);
    }
    if (strong_topics.length === 0 && chapterEntries.length > 1) {
      strong_topics.push(sortedWeakToStrong[sortedWeakToStrong.length - 1][0]);
    }

    const totalAttempted = attempt.correct_count + attempt.wrong_count;
    const accuracy = totalAttempted ? Math.round((attempt.correct_count / totalAttempted) * 100) : 0;
    const testTitle = (attempt.tests as any)?.title ?? "NEET Mock Test";
    const minutes = Math.round(attempt.time_spent_seconds / 60);

    // Default intelligent expert analysis
    let ai_summary = `In ${testTitle}, you scored ${attempt.score} marks with an overall accuracy of ${accuracy}%. You attempted ${totalAttempted} questions in ${minutes} minutes. ${
      accuracy >= 80
        ? "Excellent accuracy - focus on maintaining speed and eliminating minor calculation errors."
        : accuracy >= 60
        ? "Good performance with solid core fundamentals. Prioritize negative-marking reduction in weaker chapters."
        : "Foundational concepts need consolidation. Focus on high-weightage NCERT topics and formula revisions."
    }`;

    let study_plan = `Day 1-2: Intensive NCERT theory review for ${weak_topics.slice(0, 2).join(" & ") || "weak chapters"}.
Day 3: Solve 50+ PYQs on ${weak_topics[0] || "high-priority topics"} with strict timer.
Day 4: Formula sheet revision & error analysis of incorrect questions.
Day 5-6: Mixed topic timed drills focusing on speed & accuracy.
Day 7: Re-attempt a full chapter-wise test to measure improvement.`;

    // Try Grok (xAI) if configured
    const xaiKey = process.env.XAI_API_KEY;
    if (xaiKey) {
      try {
        const prompt = `You are a top NEET India mentor analyzing a mock test scorecard.
Test: ${testTitle}
Score: ${attempt.score} marks | Correct: ${attempt.correct_count} | Wrong: ${attempt.wrong_count} | Skipped: ${attempt.unattempted_count} | Time: ${minutes} min | Accuracy: ${accuracy}%
Weak Chapters: ${weak_topics.join(", ") || "None"}
Strong Chapters: ${strong_topics.join(", ") || "None"}

Generate JSON only with:
1. "summary": 2-3 concise, highly actionable sentences addressing accuracy and negative marking.
2. "study_plan": A 5-line 7-day revision schedule mentioning the weak chapters.`;

        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${xaiKey}`,
          },
          body: JSON.stringify({
            model: "grok-2-latest",
            messages: [
              { role: "system", content: "You are an expert NEET analysis AI. Output valid JSON only." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");
          if (parsed.summary) ai_summary = parsed.summary;
          if (parsed.study_plan) {
            study_plan = typeof parsed.study_plan === "string" ? parsed.study_plan : Object.values(parsed.study_plan).join("\n");
          }
        }
      } catch (e) {
        console.warn("[ai-analysis] Grok note (using fallback):", e);
      }
    }

    // Save to Supabase analysis table
    await supabase.from("analysis").upsert({
      attempt_id: data.attemptId,
      subject_breakdown: { subjects: bySubject, chapters: byChapter } as any,
      ai_summary,
      weak_topics,
      strong_topics,
      study_plan,
      updated_at: new Date().toISOString(),
    });

    return {
      ok: true,
      analysis: {
        ai_summary,
        weak_topics,
        strong_topics,
        study_plan,
        subject_breakdown: { subjects: bySubject, chapters: byChapter },
      },
    };
  });

