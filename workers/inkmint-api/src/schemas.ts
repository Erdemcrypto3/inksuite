import { z } from 'zod';

export const TxHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const GenerateBodySchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  txHash: TxHashSchema,
});

export const CounterInitSchema = z.object({
  count: z.number().int().min(1),
});

const UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/json', 'text/plain'] as const;
const SCORE_ALLOWED_TYPES = ['image/svg+xml', 'application/json'] as const;

export const UploadContentTypeSchema = z.string().refine(
  (ct) => UPLOAD_ALLOWED_TYPES.some((t) => ct.startsWith(t)),
  { message: 'Unsupported content type' }
);

export const ScoreContentTypeSchema = z.string().refine(
  (ct) => SCORE_ALLOWED_TYPES.some((t) => ct.startsWith(t)),
  { message: 'Only SVG and JSON allowed for score uploads' }
);

const FILE_ALLOWED_PREFIXES = ['score/', 'covers/', 'articles/', 'metadata/'] as const;

export const FileKeySchema = z.string().min(1).refine(
  (key) => FILE_ALLOWED_PREFIXES.some((p) => key.startsWith(p)),
  { message: 'Forbidden' }
);
