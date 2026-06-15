import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const policiesTable = pgTable("policies", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  policy_name: text("policy_name").notNull(),
  policy_type: text("policy_type").notNull(),
  simple_explanation: text("simple_explanation").notNull(),
  claim_difficulty_score: text("claim_difficulty_score").notNull(),
  coverage: text("coverage").array().notNull().default([]),
  exclusions: text("exclusions").array().notNull().default([]),
  claim_process: text("claim_process").array().notNull().default([]),
  important_warnings: text("important_warnings").array().notNull().default([]),
  waiting_periods: text("waiting_periods").array().notNull().default([]),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertPolicySchema = createInsertSchema(policiesTable).omit({
  id: true,
  created_at: true,
});

export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policiesTable.$inferSelect;
