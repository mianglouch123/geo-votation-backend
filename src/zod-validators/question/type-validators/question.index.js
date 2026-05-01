import { z } from "zod";

import {DateConfigSchema} from "./date.schema.validator.js";
import {HourConfigSchema} from "./hour.schema.validator.js";
import {ShortAnswerConfigSchema} from "./short.anwer.schema.validator.js";
import  {LargeAnswerConfigSchema} from "./large.answer.schema.validator.js";
import {MultiOptionConfigSchema} from "./multi.option.schema.validator.js";
export const QuestionTypeConfigSchemas = z.discriminatedUnion("type", [
 z.object({
    type: z.literal("DATE"),
    config: DateConfigSchema,
  }),
  z.object({
    type: z.literal("HOUR"),
    config: HourConfigSchema,
  }),
  z.object({
    type: z.literal("SHORTANSWER"),
    config: ShortAnswerConfigSchema,
  }),
  z.object({
    type: z.literal("LARGEANSWER"),
    config: LargeAnswerConfigSchema,
  }),
  z.object({
    type: z.literal("MULTI_OPTION"),
    config: MultiOptionConfigSchema,
  }),
])