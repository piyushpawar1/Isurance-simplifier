import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
import { db } from "@workspace/db";
import { policiesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  GetPolicyParams,
  GetPolicyResponse,
  ListPoliciesResponse,
  GetPolicyStatsResponse,
} from "@workspace/api-zod";
import { analyzePolicy } from "../../lib/gemini";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = `${Date.now()}-${sanitized}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post("/policies/upload", upload.single("pdf"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No PDF file uploaded" });
    return;
  }

  const filePath = req.file.path;

  try {
    req.log.info({ filename: req.file.originalname }, "Processing uploaded PDF");

    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const extractedText = pdfData.text?.trim();

    if (!extractedText || extractedText.length < 50) {
      res.status(422).json({ error: "Could not extract readable text from this PDF. Please ensure it is a text-based PDF, not a scanned image." });
      return;
    }

    req.log.info({ chars: extractedText.length }, "PDF text extracted, sending to AI");

    const analysis = await analyzePolicy(extractedText);

    const [policy] = await db
      .insert(policiesTable)
      .values({
        filename: req.file.originalname,
        policy_name: analysis.policy_name,
        policy_type: analysis.policy_type,
        simple_explanation: analysis.simple_explanation,
        claim_difficulty_score: analysis.claim_difficulty_score,
        coverage: analysis.coverage,
        exclusions: analysis.exclusions,
        claim_process: analysis.claim_process,
        important_warnings: analysis.important_warnings,
        waiting_periods: analysis.waiting_periods,
      })
      .returning();

    fs.unlink(filePath, (err) => {
      if (err) req.log.warn({ err }, "Failed to delete temp upload file");
    });

    res.status(201).json(GetPolicyResponse.parse(policy));
  } catch (err) {
    fs.unlink(filePath, () => {});

    req.log.error({ err }, "Policy analysis failed");

    if (err instanceof SyntaxError) {
      res.status(502).json({ error: "AI returned an unexpected response. Please try again." });
      return;
    }

    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("Only PDF")) {
      res.status(400).json({ error: message });
      return;
    }

    if (message.includes("429") || message.includes("Too Many Requests") || message.includes("quota")) {
      res.status(429).json({ error: "Gemini API quota exceeded. Your free-tier limit has been reached. Please wait a minute and try again, or enable billing at https://ai.google.dev/gemini-api/docs/rate-limits" });
      return;
    }

    if (message.includes("403") || message.includes("API_KEY") || message.includes("invalid") || message.includes("API key")) {
      res.status(403).json({ error: "Invalid Gemini API key. Please check your GEMINI_API_KEY in Replit Secrets." });
      return;
    }

    if (message.includes("404") || message.includes("not found for API version")) {
      res.status(502).json({ error: "The AI model is temporarily unavailable. Please try again in a moment." });
      return;
    }

    res.status(500).json({ error: `Failed to analyze policy: ${message.slice(0, 200)}` });
  }
});

router.get("/policies/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(policiesTable);
    const total = totalResult[0]?.count ?? 0;

    const typeRows = await db
      .select({
        type: policiesTable.policy_type,
        count: sql<number>`count(*)::int`,
      })
      .from(policiesTable)
      .groupBy(policiesTable.policy_type);

    const recentPolicies = await db
      .select()
      .from(policiesTable)
      .orderBy(desc(policiesTable.created_at))
      .limit(5);

    const stats = GetPolicyStatsResponse.parse({
      total_policies: total,
      policy_types: typeRows.map((r) => ({ type: r.type, count: r.count })),
      avg_difficulty_score: total > 0 ? "Varies by policy" : "No data",
      recent_policies: recentPolicies.map((p) => ({
        ...p,
        created_at: p.created_at.toISOString(),
      })),
    });

    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get policy stats");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/policies", async (req: Request, res: Response): Promise<void> => {
  try {
    const policies = await db
      .select()
      .from(policiesTable)
      .orderBy(desc(policiesTable.created_at));

    const mapped = policies.map((p) => ({
      ...p,
      created_at: p.created_at.toISOString(),
    }));

    res.json(ListPoliciesResponse.parse(mapped));
  } catch (err) {
    req.log.error({ err }, "Failed to list policies");
    res.status(500).json({ error: "Failed to load policies" });
  }
});

router.get("/policies/:id", async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPolicyParams.safeParse({ id: raw });

  if (!params.success) {
    res.status(400).json({ error: "Invalid policy ID" });
    return;
  }

  try {
    const [policy] = await db
      .select()
      .from(policiesTable)
      .where(eq(policiesTable.id, params.data.id));

    if (!policy) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }

    res.json(GetPolicyResponse.parse({
      ...policy,
      created_at: policy.created_at.toISOString(),
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get policy");
    res.status(500).json({ error: "Failed to load policy" });
  }
});

export default router;
