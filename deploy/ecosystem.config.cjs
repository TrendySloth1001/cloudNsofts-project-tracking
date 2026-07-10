// pm2 process definitions for the CloudNSofts app. Run from the repo root:
//   pm2 start deploy/ecosystem.config.cjs && pm2 save
// The backend reads backend/.env at runtime; the frontend baked
// NEXT_PUBLIC_API_URL at build time, so neither needs env injected here.
module.exports = {
  apps: [
    {
      name: 'cnsofts-backend',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'cnsofts-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run start',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '800M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
