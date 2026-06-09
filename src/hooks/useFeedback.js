import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ww_feedback';
const SCHEMA_VERSION = 1;
const MIN_FEEDBACK_FOR_NUDGE = 5;
const NUDGE_STEP = 0.05;
const NUDGE_CLAMP = 0.15;
const POSITIVE_HIGH = 0.8;
const POSITIVE_LOW = 0.4;

const DEFAULT = {
  schemaVersion: SCHEMA_VERSION,
  totalFeedback: 0,
  positiveCount: 0, // derived: positiveRate = positiveCount / totalFeedback
  thresholdNudge: 0, // clamped to [-NUDGE_CLAMP, +NUDGE_CLAMP]
  answered: [], // "windowId:YYYY-MM-DD" strings — dedup the prompt
};

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== SCHEMA_VERSION) return { ...DEFAULT };
    return { ...DEFAULT, ...parsed, answered: parsed.answered ?? [] };
  } catch {
    return { ...DEFAULT };
  }
}

function write(data) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable — ignore.
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function answerKey(windowId, date) {
  return `${windowId}:${date ?? todayISO()}`;
}

const subscribers = new Set();
const notify = () => {
  for (const s of subscribers) s();
};

export function useFeedback() {
  const [feedback, setFeedback] = useState(read);

  useEffect(() => {
    const onChange = () => setFeedback(read());
    subscribers.add(onChange);
    return () => subscribers.delete(onChange);
  }, []);

  const submitFeedback = useCallback((windowId, wasHelpful, date = todayISO()) => {
    setFeedback((prev) => {
      const key = answerKey(windowId, date);
      if (prev.answered.includes(key)) return prev; // idempotent
      const total = prev.totalFeedback + 1;
      const positives = prev.positiveCount + (wasHelpful ? 1 : 0);
      let nudge = prev.thresholdNudge;
      if (total >= MIN_FEEDBACK_FOR_NUDGE) {
        const rate = positives / total;
        if (rate > POSITIVE_HIGH) nudge = clamp(nudge + NUDGE_STEP, -NUDGE_CLAMP, NUDGE_CLAMP);
        else if (rate < POSITIVE_LOW) nudge = clamp(nudge - NUDGE_STEP, -NUDGE_CLAMP, NUDGE_CLAMP);
      }
      const next = {
        schemaVersion: SCHEMA_VERSION,
        totalFeedback: total,
        positiveCount: positives,
        thresholdNudge: nudge,
        answered: [...prev.answered, key],
      };
      write(next);
      notify();
      return next;
    });
  }, []);

  const hasAnswered = useCallback(
    (windowId, date = todayISO()) => feedback.answered.includes(answerKey(windowId, date)),
    [feedback.answered]
  );

  const getThresholdNudge = useCallback(() => feedback.thresholdNudge, [feedback.thresholdNudge]);

  const positiveRate =
    feedback.totalFeedback > 0 ? feedback.positiveCount / feedback.totalFeedback : 0;

  return {
    ...feedback,
    positiveRate,
    submitFeedback,
    getThresholdNudge,
    hasAnswered,
  };
}

export function getStoredNudge() {
  return read().thresholdNudge;
}
