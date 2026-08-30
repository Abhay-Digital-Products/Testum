-- Extend answer_status enum to safely support all CBT engine client states
ALTER TYPE public.answer_status ADD VALUE IF NOT EXISTS 'not_visited';
ALTER TYPE public.answer_status ADD VALUE IF NOT EXISTS 'not_answered';
ALTER TYPE public.answer_status ADD VALUE IF NOT EXISTS 'marked';
ALTER TYPE public.answer_status ADD VALUE IF NOT EXISTS 'answered_marked';
