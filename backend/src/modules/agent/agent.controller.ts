import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { asyncHandler } from '../../shared/http/async-handler';
import { HttpError } from '../../shared/http/http-error';
import { env } from '../../infra/env';

/** Read the bundle, tolerant of the working directory (repo root or backend/).
 *  An absolute MCP_BUNDLE_PATH is used verbatim; a relative one is tried from
 *  cwd and its parent. */
async function readBundle(): Promise<Buffer | null> {
  const p = env.MCP_BUNDLE_PATH;
  const candidates = isAbsolute(p)
    ? [p]
    : [resolve(process.cwd(), p), resolve(process.cwd(), '..', p)];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

export const agentController = {
  // Public download of the self-contained MCP server bundle. Any device can
  // fetch this over the tunnel and run it with `node cnsofts-mcp.mjs` — no npm
  // registry involved. The bundle is client code only; the PAT is supplied via
  // env at runtime, so nothing secret is served here.
  mcpServer: asyncHandler(async (_req, res) => {
    const bundle = await readBundle();
    if (!bundle) {
      throw HttpError.notFound(
        'MCP server bundle is not available on this server',
      );
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cnsofts-mcp.mjs"',
    );
    res.setHeader('Cache-Control', 'no-cache');
    res.send(bundle);
  }),
};
