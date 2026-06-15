import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const RETRYABLE_CODES = [429, 500, 502, 503, 504];

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      const msg = (err as { message?: string }).message ?? "";
      const isRetryable =
        (status != null && RETRYABLE_CODES.includes(status)) ||
        msg.includes("503") || msg.includes("502") || msg.includes("UNAVAILABLE") ||
        msg.includes("overloaded") || msg.includes("high demand");

      if (!isRetryable || attempt === maxAttempts) break;

      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000); // 1s, 2s, 4s, 8s
      logger.warn({ attempt, delayMs, status }, "Gemini transient error — retrying");
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export interface PolicyAnalysis {
  policy_name: string;
  policy_type: string;
  coverage: string[];
  exclusions: string[];
  claim_process: string[];
  important_warnings: string[];
  simple_explanation: string;
  claim_difficulty_score: string;
  waiting_periods: string[];
}

export async function analyzePolicy(pdfText: string): Promise<PolicyAnalysis> {
  const prompt = `You are an insurance expert.

Analyze this insurance policy and explain it in language understandable by a 10th-grade student.

Return ONLY valid JSON with exactly this structure (no markdown, no code blocks, just raw JSON):

{
  "policy_name": "string - the name of this insurance policy",
  "policy_type": "string - type like Health, Life, Auto, Home, etc.",
  "coverage": ["array of strings - what is covered, in plain English"],
  "exclusions": ["array of strings - what is NOT covered, in plain English"],
  "claim_process": ["array of strings - step by step how to file a claim"],
  "important_warnings": ["array of strings - critical things the policyholder should know"],
  "simple_explanation": "string - a 2-3 sentence plain English summary of the whole policy",
  "claim_difficulty_score": "string - e.g. '3/10 — Easy' or '7/10 — Complex', with a brief reason",
  "waiting_periods": ["array of strings - any waiting periods before coverage starts"]
}

Avoid legal jargon. Use simple and concise language. Every array should have at least one item.

Here is the insurance policy text:

${pdfText.slice(0, 50000)}`;

  logger.info("Sending policy text to Gemini for analysis");

  const response = await withRetry(() =>
    ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt })
  );

  const responseText = response.text?.trim() ?? "";

  const cleaned = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as PolicyAnalysis;

  if (!parsed.policy_name || !parsed.policy_type || !parsed.simple_explanation) {
    throw new Error("Gemini response missing required fields");
  }

  return {
    policy_name: parsed.policy_name ?? "Unknown Policy",
    policy_type: parsed.policy_type || "General Insurance",
    coverage: Array.isArray(parsed.coverage) ? parsed.coverage : [],
    exclusions: Array.isArray(parsed.exclusions) ? parsed.exclusions : [],
    claim_process: Array.isArray(parsed.claim_process) ? parsed.claim_process : [],
    important_warnings: Array.isArray(parsed.important_warnings) ? parsed.important_warnings : [],
    simple_explanation: parsed.simple_explanation || "",
    claim_difficulty_score: parsed.claim_difficulty_score || "Unknown",
    waiting_periods: Array.isArray(parsed.waiting_periods) ? parsed.waiting_periods : [],
  };
}

export async function generateExplanation(prompt: string): Promise<string> {
  logger.info("Generating multilingual explanation via Gemini");

  const response = await withRetry(() =>
    ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt })
  );

  return response.text?.trim() ?? "";
}
