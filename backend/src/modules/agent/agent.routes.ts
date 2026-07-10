import { Router } from 'express';
import { agentController } from './agent.controller';

// Public (no auth) — a fresh device needs to download the MCP server before it
// has any session. The bundle carries no secret; the PAT is passed at runtime.
export const agentRoutes = Router();

agentRoutes.get('/mcp-server.mjs', agentController.mcpServer);
