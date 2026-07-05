import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './infra/env';
import { initRealtime } from './infra/realtime';

const app = createApp();

// Wrap Express in an HTTP server so Socket.IO can share the same port.
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`API + realtime listening on http://localhost:${env.PORT}`);
});
