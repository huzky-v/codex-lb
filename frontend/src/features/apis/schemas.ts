import { z } from "zod";

export const ApiKeyTrendPointSchema = z.object({
  t: z.string().datetime({ offset: true }),
  v: z.number(),
});

export const ApiKeyTrendsResponseSchema = z.object({
  keyId: z.string(),
  cost: z.array(ApiKeyTrendPointSchema),
  tokens: z.array(ApiKeyTrendPointSchema),
});

export const ApiKeyUsage7DayResponseSchema = z.object({
  keyId: z.string(),
  totalTokens: z.number().int(),
  totalCostUsd: z.number(),
  totalRequests: z.number().int(),
  cachedInputTokens: z.number().int(),
});

export const ApiKeyAccountUsageEntrySchema = z.object({
  accountId: z.string().nullable(),
  displayName: z.string(),
  isEmailDerived: z.boolean(),
  requestCount: z.number().int(),
  totalCostUsd: z.number(),
});

export const ApiKeyAccountUsage7DayResponseSchema = z.object({
  keyId: z.string(),
  totalCostUsd: z.number(),
  accounts: z.array(ApiKeyAccountUsageEntrySchema),
});

export type ApiKeyTrendPoint = z.infer<typeof ApiKeyTrendPointSchema>;
export type ApiKeyTrendsResponse = z.infer<typeof ApiKeyTrendsResponseSchema>;
export type ApiKeyUsage7DayResponse = z.infer<typeof ApiKeyUsage7DayResponseSchema>;
export type ApiKeyAccountUsageEntry = z.infer<typeof ApiKeyAccountUsageEntrySchema>;
export type ApiKeyAccountUsage7DayResponse = z.infer<typeof ApiKeyAccountUsage7DayResponseSchema>;
