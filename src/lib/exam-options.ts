export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export type NormalizedOption = {
  key: string;
  text?: string;
  image_url?: string;
};

export function normalizeOptionKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  // Handle number directly: 1-4 (1-based)
  if (typeof value === "number") {
    if (value >= 1 && value <= 4) return OPTION_LETTERS[value - 1];
    return null;
  }

  // Handle object with key/selected_option/value/etc.
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.key ?? obj.selected_option ?? obj.selectedOption ?? obj.option ?? obj.value;
    if (candidate && candidate !== value) {
      const res = normalizeOptionKey(candidate);
      if (res) return res;
    }
  }

  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;

  // Direct single letter: 'A' - 'D'
  if (/^[A-D]$/.test(raw)) return raw;

  // Direct single digit: '1' - '4'
  if (/^[1-4]$/.test(raw)) return OPTION_LETTERS[Number(raw) - 1];

  // Parenthesized or dotted letters/numbers: '(A)', '[A]', 'A.', '(1)', '[1]', '1.'
  const bracketMatch = raw.match(/^[(\[]?\s*([A-D]|[1-4])\s*[).\]]?$/);
  if (bracketMatch) {
    const char = bracketMatch[1];
    if (/^[A-D]$/.test(char)) return char;
    if (/^[1-4]$/.test(char)) return OPTION_LETTERS[Number(char) - 1];
  }

  // Labeled variants: 'Option A', 'OPTION (A)', 'Choice A', 'Ans: A', 'Option 1', 'Option (1)'
  const labeled = raw.match(/^(?:OPTION|CHOICE|ANS|ANSWER|KEY)?\s*[:\-.]?\s*\(?\s*([A-D]|[1-4])\s*\)?$/);
  if (labeled) {
    const char = labeled[1];
    if (/^[A-D]$/.test(char)) return char;
    if (/^[1-4]$/.test(char)) return OPTION_LETTERS[Number(char) - 1];
  }

  // Fallback: look for first standalone A-D or 1-4 in string if short
  if (raw.length <= 15) {
    const inlineMatch = raw.match(/\b([A-D])\b/);
    if (inlineMatch) return inlineMatch[1];
    const numMatch = raw.match(/\b([1-4])\b/);
    if (numMatch) return OPTION_LETTERS[Number(numMatch[1]) - 1];
  }

  return null;
}

export function normalizeQuestionOptions(options: unknown): NormalizedOption[] {
  if (!Array.isArray(options) || options.length === 0) {
    return OPTION_LETTERS.map((key) => ({ key, text: `Option ${key}` }));
  }

  return OPTION_LETTERS.map((letter, index) => {
    const keyed = options.find(
      (option: unknown) =>
        typeof option === "object" &&
        option !== null &&
        normalizeOptionKey((option as { key?: unknown }).key) === letter,
    ) as { key?: string; text?: string; label?: string; value?: string; image_url?: string } | undefined;

    if (keyed) {
      const text =
        (typeof keyed.text === "string" && keyed.text.trim()) ||
        (typeof keyed.label === "string" && keyed.label.trim()) ||
        (typeof keyed.value === "string" && keyed.value.trim()) ||
        undefined;
      return { key: letter, text, image_url: keyed.image_url };
    }

    const raw = options[index];
    if (typeof raw === "string" && raw.trim()) {
      return { key: letter, text: raw.trim() };
    }

    if (raw && typeof raw === "object") {
      const obj = raw as { text?: string; label?: string; value?: string; image_url?: string };
      const text =
        (typeof obj.text === "string" && obj.text.trim()) ||
        (typeof obj.label === "string" && obj.label.trim()) ||
        (typeof obj.value === "string" && obj.value.trim()) ||
        `Option ${letter}`;
      return { key: letter, text, image_url: obj.image_url };
    }

    return { key: letter, text: `Option ${letter}` };
  });
}

export function extractSelectedOption(answer: unknown): string | null {
  if (!answer || typeof answer !== "object") return null;

  const record = answer as Record<string, unknown>;
  const candidates = [
    record.selected_option,
    record.selectedOption,
    record.option_key,
    record.optionKey,
    record.answer,
    record.user_answer,
    record.answer_option,
    record.choice,
    record.option,
    record.value,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOptionKey(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function hasAttemptedAnswer(answer: unknown): boolean {
  if (!answer || typeof answer !== "object") return false;

  const record = answer as Record<string, unknown>;
  if (extractSelectedOption(record) !== null) return true;
  if (record.is_correct === true || record.is_correct === false) return true;

  const status = String(record.status ?? "").toLowerCase();
  return status === "answered" || status === "answered_marked";
}

export function getOptionText(options: unknown, key: string): string {
  const normalized = normalizeQuestionOptions(options);
  const match = normalized.find((option) => normalizeOptionKey(option.key) === normalizeOptionKey(key));
  return match?.text?.trim() || `Option ${key}`;
}

export function isOptionSelected(selected: unknown, key: string): boolean {
  const selectedKey = normalizeOptionKey(selected);
  const optionKey = normalizeOptionKey(key);
  return Boolean(selectedKey && optionKey && selectedKey === optionKey);
}

export function isAnswerCorrect(selected: unknown, correct: unknown): boolean {
  const selectedKey = normalizeOptionKey(selected);
  const correctKey = normalizeOptionKey(correct);
  return Boolean(selectedKey && correctKey && selectedKey === correctKey);
}

export function normalizeCorrectOption(value: unknown): string | null {
  return normalizeOptionKey(value);
}

