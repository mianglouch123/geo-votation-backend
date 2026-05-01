import { z } from "zod";

export const DateConfigSchema = z.object({
  date : z.iso.date()
}).strict();
