import jsPDF from "jspdf";
import logoAsset from "@/assets/testum-logo.png.asset.json";
import { fetchImageBase64 } from "@/lib/image-proxy.functions";

/* ─── Types ──────────────────────────────────────────── */
type RGB = [number, number, number];
type Stat = { total: number; correct: number; wrong: number; unattempted: number; timeSpent?: number };

export type QuestionReview = {
  order_index: number;
  subject: string;
  chapter?: string | null;
  question_text?: string | null;
  question_image_url?: string | null;
  option_type?: string | null;
  options?: unknown;
  correct_option: string;
  selected_option?: string | null;
  is_correct?: boolean | null;
  time_spent_seconds?: number;
  solution_text?: string | null;
  solution_image_url?: string | null;
  solution_video_url?: string | null;
};

export type ResultPdfInput = {
  studentName: string;
  studentClass?: string | null;
  testTitle: string;
  submittedAt: string;
  score: number;
  totalMax: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeSpentSeconds: number;
  durationMinutes: number;
  subjects: Record<string, Stat>;
  chapters: Record<string, Stat>;
  aiSummary?: string | null;
  weakTopics?: string[] | null;
  strongTopics?: string[] | null;
  studyPlan?: string | null;
  questions?: QuestionReview[];
};

/* ─── Brand Palette (matches site theme exactly) ─────── */
const PRIMARY: RGB    = [37,  99,  235]; // Royal Blue #2563EB
const PRIMARY_L: RGB  = [79, 140, 255]; // Lighter blue for gradients
const DARK: RGB       = [15,  23,  42];  // Slate 900
const GREY: RGB       = [100, 116, 139]; // Slate 500
const GREY_L: RGB     = [148, 163, 184]; // Slate 400
const LIGHT_BG: RGB   = [248, 250, 252]; // Slate 50
const BORDER: RGB     = [226, 232, 240]; // Slate 200

const GREEN: RGB      = [16,  185, 129]; // Emerald 500
const GREEN_BG: RGB   = [236, 253, 245]; // Emerald 50
const RED: RGB        = [239, 68,  68];  // Rose 500
const RED_BG: RGB     = [254, 242, 242]; // Rose 50
const AMBER: RGB      = [245, 158, 11];  // Amber 500
const AMBER_BG: RGB   = [255, 251, 235]; // Amber 50
const INDIGO_BG: RGB  = [238, 242, 255]; // Indigo 50
const INDIGO_BD: RGB  = [199, 210, 254]; // Indigo 200

const WHITE: RGB      = [255, 255, 255];

/* ─── Robust Image Loader with Fallbacks ─────────────── */

/**
 * Loads an image from URL using 3 strategies:
 * 1. Direct fetch -> Blob -> DataURL
 * 2. HTML Image element + Canvas
 * 3. Server-side proxy function (bypasses browser CORS completely)
 */
async function toDataUrl(url: string): Promise<string | null> {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:")) return url;

  // Strategy 1: Direct fetch
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (b64 && b64.startsWith("data:")) return b64;
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Image element with canvas conversion
  try {
    const canvasData = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 600;
          canvas.height = img.naturalHeight || 400;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("No canvas context"));
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = url;
    });
    if (canvasData) return canvasData;
  } catch {
    // Continue to server proxy strategy
  }

  // Strategy 3: Server proxy fallback (always works, no browser CORS restriction)
  try {
    const proxied = await fetchImageBase64({ data: { url } });
    if (proxied && proxied.startsWith("data:")) return proxied;
  } catch (err) {
    console.warn("Server proxy image fetch failed:", url, err);
  }

  return null;
}

async function loadImage(url: string): Promise<{ data: string; w: number; h: number; format: string } | null> {
  const data = await toDataUrl(url);
  if (!data) return null;

  try {
    return await new Promise<{ data: string; w: number; h: number; format: string }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 600;
        const h = img.naturalHeight || 400;
        try {
          // Standardize through canvas to JPEG for bulletproof jsPDF compatibility
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0);
            const jpegData = canvas.toDataURL("image/jpeg", 0.92);
            resolve({ data: jpegData, w, h, format: "JPEG" });
            return;
          }
        } catch {
          // Fallback to original data URL if canvas is tainted
        }
        resolve({ data, w, h, format: data.includes("image/png") ? "PNG" : "JPEG" });
      };
      img.onerror = reject;
      img.src = data;
    });
  } catch {
    return null;
  }
}

async function loadLogo(): Promise<string | null> {
  return toDataUrl(logoAsset.url);
}

/* ─── Main PDF Function ───────────────────────────────── */
export async function downloadResultPdf(input: ResultPdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();  // 595.28
  const H = doc.internal.pageSize.getHeight(); // 841.89
  const M = 36;
  let y = 0;

  const logo = await loadLogo();

  /* Ensure enough space remains on page; otherwise add new page */
  const ensure = (need: number) => {
    if (y + need > H - 52) {
      doc.addPage();
      drawPageBg();
      y = M + 10;
    }
  };

  /* Subtle off-white background every page */
  const drawPageBg = () => {
    doc.setFillColor(252, 253, 255);
    doc.rect(0, 0, W, H, "F");
  };

  drawPageBg();

  /* ── 1. HEADER BANNER ───────────────────────────────── */
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 88, "F");
  doc.setFillColor(...PRIMARY_L);
  doc.setGState(doc.GState({ opacity: 0.18 }));
  doc.rect(W * 0.55, 0, W * 0.45, 88, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // Decorative circle accents
  doc.setFillColor(...WHITE);
  doc.setGState(doc.GState({ opacity: 0.07 }));
  doc.circle(W - 30, -10, 80, "F");
  doc.circle(W - 80, 60, 50, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // Logo
  if (logo) {
    try { doc.addImage(logo, "PNG", M, 17, 50, 50); } catch { /* ignore */ }
  }

  const txtX = M + (logo ? 62 : 0);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TESTUM", txtX, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(199, 220, 255);
  doc.text("Official Performance & Diagnostic Analysis Report", txtX, 55);

  doc.setFontSize(7.5);
  doc.setTextColor(179, 206, 255);
  doc.text("Generated: " + new Date(input.submittedAt || Date.now()).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }), W - M, 42, { align: "right" });
  doc.text("testum.in  ·  NEET Exam Simulation", W - M, 56, { align: "right" });

  y = 105;

  /* ── 2. TEST & STUDENT CARD ─────────────────────────── */
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(M, y, W - M * 2, 54, 8, 8, "FD");

  // Left color accent bar
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(M, y, 5, 54, 4, 4, "F");

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(input.testTitle, M + 16, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  const studentLine = `Student: ${input.studentName}${input.studentClass ? `   |   Class: ${input.studentClass}` : ""}   |   Duration: ${input.durationMinutes} min`;
  doc.text(studentLine, M + 16, y + 34);

  const submittedDate = new Date(input.submittedAt || Date.now()).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  doc.text("Submitted: " + submittedDate, M + 16, y + 46);

  y += 65;

  /* ── 3. PRIMARY METRIC CARDS ────────────────────────── */
  const attempted = input.correct + input.wrong;
  const accuracy = attempted ? Math.round((input.correct / attempted) * 100) : 0;
  const percent   = input.totalMax ? Math.round((input.score / input.totalMax) * 100) : 0;
  const minSpent  = Math.floor(input.timeSpentSeconds / 60);

  const metrics: Array<{ label: string; value: string; sub: string; color: RGB; accentBg: RGB }> = [
    { label: "FINAL SCORE",      value: `${Math.round(input.score)}/${input.totalMax}`, sub: `${percent}% of max`,               color: PRIMARY, accentBg: INDIGO_BG },
    { label: "ACCURACY",         value: `${accuracy}%`,                                 sub: `${input.correct}/${attempted} att.`, color: accuracy >= 75 ? GREEN : accuracy >= 50 ? AMBER : RED, accentBg: accuracy >= 75 ? GREEN_BG : accuracy >= 50 ? AMBER_BG : RED_BG },
    { label: "TIME USED",        value: `${minSpent} min`,                               sub: `of ${input.durationMinutes} min`,   color: DARK, accentBg: LIGHT_BG },
    { label: "ATTEMPT RATE",     value: `${attempted}/${attempted + input.unattempted}`, sub: `${input.unattempted} skipped`,      color: DARK, accentBg: LIGHT_BG },
  ];

  const mw = (W - M * 2 - 15) / 4;
  metrics.forEach((m, i) => {
    const x = M + i * (mw + 5);
    doc.setFillColor(...m.accentBg);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, mw, 58, 7, 7, "FD");

    // Bottom accent line
    doc.setFillColor(...m.color);
    doc.roundedRect(x + 6, y + 51, mw - 12, 3, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(m.label, x + 8, y + 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...m.color);
    doc.text(m.value, x + 8, y + 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GREY_L);
    doc.text(m.sub, x + 8, y + 45);
  });
  y += 68;

  /* ── 4. ANSWER BREAKDOWN ROW ────────────────────────── */
  const bw = (W - M * 2 - 10) / 3;
  const breakdown = [
    { label: "CORRECT",      count: input.correct,     score: `+${input.correct * 4} Marks`,   color: GREEN, bg: GREEN_BG, border: GREEN },
    { label: "INCORRECT",    count: input.wrong,       score: `-${input.wrong} Marks`,          color: RED,   bg: RED_BG,   border: RED },
    { label: "UNATTEMPTED",  count: input.unattempted, score: "0 Marks",                        color: GREY,  bg: LIGHT_BG, border: BORDER },
  ];

  breakdown.forEach((b, i) => {
    const x = M + i * (bw + 5);
    doc.setFillColor(...b.bg);
    doc.setDrawColor(...b.border);
    doc.roundedRect(x, y, bw, 42, 7, 7, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...b.color);
    doc.text(b.label, x + 10, y + 14);

    doc.setFontSize(18);
    doc.text(String(b.count), x + 10, y + 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...b.color);
    doc.text(b.score, x + bw - 10, y + 34, { align: "right" });
  });
  y += 52;

  /* ── Helper: Section Heading ────────────────────────── */
  const heading = (text: string, color: RGB = PRIMARY) => {
    ensure(38);
    doc.setFillColor(...color);
    doc.roundedRect(M, y - 2, 4, 18, 2, 2, "F");
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setGState(doc.GState({ opacity: 0.06 }));
    doc.rect(M, y - 2, W - M * 2, 18, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...color);
    doc.text(text, M + 10, y + 11);
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
  };

  /* ── Helper: Paragraph ──────────────────────────────── */
  const paragraph = (text: string, indent = 0) => {
    const lines = doc.splitTextToSize(text, W - M * 2 - indent);
    for (const line of lines) {
      ensure(14);
      doc.text(line, M + indent, y);
      y += 12;
    }
    y += 3;
  };

  /* ── Helper: Progress bar ───────────────────────────── */
  const progressBar = (x: number, barY: number, barW: number, val: number, total: number, color: RGB) => {
    const pct = total ? val / total : 0;
    doc.setFillColor(...BORDER);
    doc.roundedRect(x, barY, barW, 5, 2.5, 2.5, "F");
    if (pct > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(x, barY, barW * pct, 5, 2.5, 2.5, "F");
    }
  };

  /* ── 5. AI ANALYSIS SECTION ─────────────────────────── */
  if (input.aiSummary || input.studyPlan || (input.weakTopics?.length ?? 0) > 0) {
    heading("AI Performance Analysis & Recommendations");

    if (input.aiSummary) {
      const lines = doc.splitTextToSize(input.aiSummary, W - M * 2 - 24);
      const boxH = lines.length * 13 + 28;
      ensure(boxH + 10);

      doc.setFillColor(...INDIGO_BG);
      doc.setDrawColor(...INDIGO_BD);
      doc.roundedRect(M, y, W - M * 2, boxH, 8, 8, "FD");

      // Left bar
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(M, y, 4, boxH, 4, 4, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.text("NEET MENTOR VERDICT", M + 14, y + 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      let ly = y + 26;
      for (const line of lines) {
        doc.text(line, M + 14, ly);
        ly += 13;
      }
      y += boxH + 12;
    }

    // Weak / Strong Topics
    const weakList   = input.weakTopics  ?? [];
    const strongList = input.strongTopics ?? [];

    if (weakList.length > 0 || strongList.length > 0) {
      ensure(52);
      const chipW = (W - M * 2 - 8) / 2;

      // Weak
      doc.setFillColor(...RED_BG);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(M, y, chipW, 46, 7, 7, "FD");
      doc.setFillColor(...RED);
      doc.roundedRect(M, y, 4, 46, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...RED);
      doc.text("FOCUS AREAS  (Low Accuracy)", M + 10, y + 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      const weakTxt = doc.splitTextToSize(weakList.join(" · ") || "None flagged", chipW - 20);
      doc.text(weakTxt.slice(0, 2), M + 10, y + 27);

      // Strong
      const sx = M + chipW + 8;
      doc.setFillColor(...GREEN_BG);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(sx, y, chipW, 46, 7, 7, "FD");
      doc.setFillColor(...GREEN);
      doc.roundedRect(sx, y, 4, 46, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREEN);
      doc.text("MASTERED TOPICS  (Strong)", sx + 10, y + 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      const strongTxt = doc.splitTextToSize(strongList.join(" · ") || "All balanced", chipW - 20);
      doc.text(strongTxt.slice(0, 2), sx + 10, y + 27);
      y += 56;
    }

    // 7-Day Study Plan
    if (input.studyPlan) {
      ensure(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PRIMARY);
      doc.text("7-DAY TARGETED ACTION PLAN:", M, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      for (const line of input.studyPlan.split("\n")) {
        if (line.trim()) paragraph("• " + line.trim(), 10);
      }
      y += 6;
    }
  }

  /* ── 6. SUBJECT-WISE BREAKDOWN ──────────────────────── */
  const subjectEntries = Object.entries(input.subjects);
  if (subjectEntries.length > 0) {
    heading("Subject-wise Performance Breakdown");

    const COLS = {
      name:  M + 10,
      bar:   M + 130,
      c:     W - M - 145,
      w:     W - M - 105,
      s:     W - M - 65,
      acc:   W - M - 10,
    };
    const barW = COLS.c - COLS.bar - 8;

    // Table header
    doc.setFillColor(...PRIMARY);
    doc.setGState(doc.GState({ opacity: 0.07 }));
    doc.rect(M, y - 7, W - M * 2, 19, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text("SUBJECT",   COLS.name, y + 5);
    doc.text("ACCURACY",  COLS.bar,  y + 5);
    doc.text("✓",         COLS.c,    y + 5);
    doc.text("✗",         COLS.w,    y + 5);
    doc.text("—",         COLS.s,    y + 5);
    doc.text("%",         COLS.acc,  y + 5, { align: "right" });
    y += 19;

    for (const [name, s] of subjectEntries) {
      ensure(24);
      const att = s.correct + s.wrong;
      const acc = att ? Math.round((s.correct / att) * 100) : 0;
      const barColor: RGB = acc >= 75 ? GREEN : acc >= 50 ? AMBER : RED;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(name.charAt(0).toUpperCase() + name.slice(1), COLS.name, y + 4);

      progressBar(COLS.bar, y - 2, barW, s.correct, s.total || (att + s.unattempted), barColor);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREEN);  doc.text(String(s.correct),    COLS.c, y + 4);
      doc.setTextColor(...RED);    doc.text(String(s.wrong),      COLS.w, y + 4);
      doc.setTextColor(...GREY);   doc.text(String(s.unattempted),COLS.s, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...barColor);
      doc.text(`${acc}%`, COLS.acc, y + 4, { align: "right" });

      doc.setDrawColor(...BORDER);
      doc.line(M, y + 10, W - M, y + 10);
      y += 20;
    }
    y += 10;
  }

  /* ── 7. CHAPTER-WISE BREAKDOWN ──────────────────────── */
  const chapterEntries = Object.entries(input.chapters);
  if (chapterEntries.length > 0) {
    heading("Chapter-wise Diagnostics & Accuracy");

    const COLS = { name: M + 10, c: W - M - 145, w: W - M - 105, s: W - M - 65, acc: W - M - 10 };

    doc.setFillColor(...PRIMARY);
    doc.setGState(doc.GState({ opacity: 0.07 }));
    doc.rect(M, y - 7, W - M * 2, 19, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text("CHAPTER / TOPIC", COLS.name, y + 5);
    doc.text("✓",   COLS.c,   y + 5);
    doc.text("✗",   COLS.w,   y + 5);
    doc.text("—",   COLS.s,   y + 5);
    doc.text("ACC", COLS.acc, y + 5, { align: "right" });
    y += 19;

    for (const [name, s] of chapterEntries) {
      ensure(22);
      const att = s.correct + s.wrong;
      const acc = att ? Math.round((s.correct / att) * 100) : 0;
      const barColor: RGB = acc >= 75 ? GREEN : acc >= 50 ? AMBER : RED;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(doc.splitTextToSize(name, 200)[0], COLS.name, y + 4);

      doc.setTextColor(...GREEN);  doc.text(String(s.correct),    COLS.c,   y + 4);
      doc.setTextColor(...RED);    doc.text(String(s.wrong),      COLS.w,   y + 4);
      doc.setTextColor(...GREY);   doc.text(String(s.unattempted),COLS.s,   y + 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...barColor);
      doc.text(`${acc}%`, COLS.acc, y + 4, { align: "right" });

      doc.setDrawColor(...BORDER);
      doc.line(M, y + 10, W - M, y + 10);
      y += 17;
    }
    y += 10;
  }

  /* ── 8. QUESTION-BY-QUESTION REVIEW ─────────────────── */
  const qs = (input.questions ?? []).slice().sort((a, b) => a.order_index - b.order_index);

  if (qs.length > 0) {
    ensure(50);
    heading("Detailed Question Review & Solutions");

    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    paragraph(`All ${qs.length} questions with question images, your response, verified correct options, and step-by-step explanations.`);

    for (const q of qs) {
      const isCorrect  = q.is_correct === true;
      const isWrong    = q.selected_option != null && !isCorrect;
      const isSkipped  = q.selected_option == null;
      const statusColor: RGB = isCorrect ? GREEN : isWrong ? RED : GREY;
      const statusLabel      = isCorrect ? "CORRECT  +4" : isWrong ? "WRONG  −1" : "NOT ATTEMPTED";
      const timeStr          = q.time_spent_seconds && q.time_spent_seconds > 0
        ? `${Math.floor(q.time_spent_seconds / 60)}m ${q.time_spent_seconds % 60}s`
        : "—";

      ensure(80);

      /* ── Q Header strip ── */
      doc.setFillColor(...statusColor);
      doc.setGState(doc.GState({ opacity: 0.09 }));
      doc.roundedRect(M, y - 6, W - M * 2, 26, 5, 5, "F");
      doc.setGState(doc.GState({ opacity: 1 }));

      doc.setFillColor(...statusColor);
      doc.roundedRect(M, y - 6, 5, 26, 4, 4, "F");

      // Q number
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...DARK);
      doc.text(`Q${q.order_index}`, M + 12, y + 10);

      // Subject · Chapter
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      const subjLabel = `${(q.subject || "").toUpperCase()}${q.chapter ? `  ·  ${q.chapter}` : ""}`;
      const truncated = doc.splitTextToSize(subjLabel, W - M * 2 - 220)[0] ?? "";
      doc.text(truncated, M + 36, y + 10);

      // Time spent
      doc.setFontSize(7);
      doc.setTextColor(...GREY_L);
      doc.text(`⏱ ${timeStr}`, W - M - 90, y + 10);

      // Status badge
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...statusColor);
      doc.text(statusLabel, W - M - 8, y + 10, { align: "right" });

      y += 30;

      /* ── Question Text ── */
      if (q.question_text) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...DARK);
        paragraph(q.question_text);
      }

      /* ── Question Image (Full width, auto aspect ratio) ── */
      if (q.question_image_url) {
        const img = await loadImage(q.question_image_url);
        if (img) {
          const maxW = W - M * 2;
          const scale = maxW / img.w;
          const rawH  = img.h * scale;
          const capH  = Math.min(rawH, 280);
          const capW  = rawH > 280 ? (img.w / img.h) * capH : maxW;
          ensure(capH + 14);
          try {
            doc.addImage(img.data, img.format || "JPEG", M, y, capW, capH);
          } catch (e) {
            console.warn("jsPDF addImage failed for question", q.order_index, e);
          }
          y += capH + 10;
        }
      }

      /* ── Options ── */
      const letters = ["A", "B", "C", "D"];
      let optionsList: Array<{ key: string; text: string }> = [];
      if (Array.isArray(q.options)) {
        optionsList = letters.map((k, i) => {
          const match = (q.options as any[]).find((o: any) => o?.key === k);
          if (match) return { key: k, text: match.text || (match.image_url ? "[Image Option]" : `Option ${k}`) };
          const raw = (q.options as any[])[i];
          return { key: k, text: typeof raw === "string" ? raw : `Option ${k}` };
        });
      }

      if (optionsList.length > 0) {
        ensure(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY);
        doc.text("OPTIONS:", M + 8, y);
        y += 10;

        for (const opt of optionsList) {
          const isOptCorrect = q.correct_option === opt.key;
          const isOptChosen  = q.selected_option === opt.key;
          const isWrongChoice = isOptChosen && !isOptCorrect;

          let bg: RGB | null  = null;
          let bd: RGB         = BORDER;
          let tc: RGB         = DARK;
          let suffix          = "";

          if (isOptCorrect && isOptChosen) { bg = GREEN_BG; bd = GREEN; tc = GREEN; suffix = "  ✓  Your Answer  (Correct)"; }
          else if (isOptCorrect)           { bg = GREEN_BG; bd = GREEN; tc = GREEN; suffix = "  ✓  Correct Answer"; }
          else if (isWrongChoice)          { bg = RED_BG;   bd = RED;   tc = RED;   suffix = "  ✗  Your Answer  (Wrong)"; }

          const label  = `  (${opt.key})  ${opt.text}${suffix}`;
          const lines  = doc.splitTextToSize(label, W - M * 2 - 20);
          const rowH   = lines.length * 12 + 12;

          ensure(rowH + 4);
          if (bg) {
            doc.setFillColor(...bg);
            doc.setDrawColor(...bd);
            doc.roundedRect(M + 6, y - 7, W - M * 2 - 6, rowH, 4, 4, "FD");
          } else {
            doc.setDrawColor(...BORDER);
            doc.roundedRect(M + 6, y - 7, W - M * 2 - 6, rowH, 4, 4, "D");
          }

          doc.setFont("helvetica", isOptCorrect || isWrongChoice ? "bold" : "normal");
          doc.setFontSize(8);
          doc.setTextColor(...tc);
          for (let li = 0; li < lines.length; li++) {
            doc.text(lines[li], M + 14, y + li * 12);
          }
          y += rowH + 3;
        }
      }

      /* ── Your Answer / Correct Answer summary line ── */
      ensure(26);
      y += 4;
      const summaryParts: string[] = [];
      if (!isSkipped) summaryParts.push(`Your Answer: (${q.selected_option})`);
      summaryParts.push(`Correct Answer: (${q.correct_option})`);
      if (!isSkipped) summaryParts.push(isCorrect ? "Result: CORRECT" : "Result: WRONG");
      else summaryParts.push("Result: NOT ATTEMPTED");

      const summaryBg: RGB   = isCorrect ? GREEN_BG  : isWrong ? RED_BG    : LIGHT_BG;
      const summaryBd: RGB   = isCorrect ? GREEN      : isWrong ? RED        : BORDER;
      const summaryTc: RGB   = isCorrect ? GREEN      : isWrong ? RED        : GREY;
      doc.setFillColor(...summaryBg);
      doc.setDrawColor(...summaryBd);
      doc.roundedRect(M, y - 5, W - M * 2, 20, 5, 5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...summaryTc);
      doc.text(summaryParts.join("   |   "), M + 10, y + 8);
      y += 24;

      /* ── Solution ── */
      if (q.solution_text || q.solution_image_url || q.solution_video_url) {
        ensure(28);
        doc.setFillColor(...INDIGO_BG);
        doc.setDrawColor(...INDIGO_BD);
        doc.roundedRect(M, y - 3, W - M * 2, 20, 5, 5, "FD");
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(M, y - 3, 5, 20, 4, 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...PRIMARY);
        doc.text("EXPLANATION & SOLUTION", M + 12, y + 10);
        y += 24;

        if (q.solution_text) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...DARK);
          paragraph(q.solution_text, 8);
        }

        if (q.solution_image_url) {
          const sImg = await loadImage(q.solution_image_url);
          if (sImg) {
            const sw  = Math.min(W - M * 2 - 8, 360);
            const sh  = Math.min((sImg.h / sImg.w) * sw, 240);
            const fsw = sh < (sImg.h / sImg.w) * sw ? (sImg.w / sImg.h) * sh : sw;
            ensure(sh + 14);
            try {
              doc.addImage(sImg.data, sImg.format || "JPEG", M + 8, y, fsw, sh);
            } catch (e) {
              console.warn("jsPDF addImage failed for solution", q.order_index, e);
            }
            y += sh + 10;
          }
        }

        if (q.solution_video_url) {
          ensure(16);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...PRIMARY);
          doc.textWithLink("▶  Watch Video Solution", M + 10, y, { url: q.solution_video_url });
          y += 16;
        }
      }

      /* ── Divider between questions ── */
      ensure(14);
      doc.setDrawColor(...BORDER);
      doc.line(M, y + 5, W - M, y + 5);
      y += 18;
    }
  }

  /* ── 9. FOOTER ON ALL PAGES ─────────────────────────── */
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setFillColor(...PRIMARY);
    doc.setGState(doc.GState({ opacity: 0.07 }));
    doc.rect(0, H - 38, W, 38, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GREY);
    doc.text("Testum  ·  India's Most Affordable NEET Test Series  ·  testum.in", M, H - 18);
    doc.text(`Page ${p} of ${totalPages}`, W - M, H - 18, { align: "right" });
  }

  /* ── 10. SAVE ───────────────────────────────────────── */
  const safe = input.testTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`testum-report-${safe}.pdf`);
}
