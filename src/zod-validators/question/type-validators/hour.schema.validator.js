import { z } from "zod";

// Validación para hora: "00" a "23"
const HourStringSchema = z
  .string()
  .regex(/^([0-1][0-9]|2[0-3])$/, "Hour must be 00-23");

// Validación para minutos: "00" a "59"
const MinuteStringSchema = z
  .string()
  .regex(/^[0-5][0-9]$/, "Minutes must be 00-59");

export const HourConfigSchema = z.object({
  hour: HourStringSchema,  // ← "14" (solo hora)
  min: MinuteStringSchema.optional().default("00")  // ← "30" o por defecto "00"
}).strict();