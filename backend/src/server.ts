import { createApp } from './app';
import { env } from './infra/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
