import { z } from 'zod';

/**
 * Runtime configuration for the MCP server, read from the environment the MCP
 * client (e.g. Claude Code) passes in. Fails fast with a clear message so a
 * misconfigured connection doesn't silently produce auth errors on every call.
 */
const envSchema = z.object({
  CNSOFTS_API_URL: z
    .string()
    .url('CNSOFTS_API_URL must be the API base URL, e.g. http://localhost:4000'),
  CNSOFTS_TOKEN: z
    .string()
    .min(1, 'CNSOFTS_TOKEN (a cnsofts_pat_… access token) is required'),
  CNSOFTS_READONLY: z.string().optional(),
  CNSOFTS_ALLOW_DELETE: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // stderr only — stdout is the MCP protocol channel and must stay clean.
  console.error(`[cnsofts-mcp] Invalid configuration:\n${issues}`);
  process.exit(1);
}

const truthy = (v?: string): boolean =>
  v === '1' || v?.toLowerCase() === 'true';

export const config = {
  /** API base URL, trailing slash trimmed. */
  apiUrl: parsed.data.CNSOFTS_API_URL.replace(/\/+$/, ''),
  token: parsed.data.CNSOFTS_TOKEN,
  /** When set, only read tools are registered. */
  readOnly: truthy(parsed.data.CNSOFTS_READONLY),
  /** When set, destructive delete_* tools are registered. */
  allowDelete: truthy(parsed.data.CNSOFTS_ALLOW_DELETE),
};
