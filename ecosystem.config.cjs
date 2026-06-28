// pm2 process configuration for production.
//
//   pm2 start ecosystem.config.cjs      # first launch
//   pm2 reload ecosystem.config.cjs     # zero-downtime restart after a deploy
//   pm2 save                            # persist across reboots (with pm2 startup)
//
// IMPORTANT:
//  - exec_mode "fork" + a SINGLE instance. This app uses SQLite and an in-process
//    deadline scheduler (src/instrumentation.ts); running multiple instances would
//    double-send reminders and contend on the DB file.
//  - watch: false. The app writes to a local SQLite file and to .next/cache on
//    every request; file-watching would trigger an endless restart loop.
//  - Secrets (AUTH_SECRET, DATABASE_URL, CRON_SECRET) live in the project .env,
//    which both Next.js and Prisma load automatically. Do NOT hard-code them here.
module.exports = {
  apps: [
    {
      name: "projectra",
      cwd: __dirname,
      // Run the Next.js production server directly (no extra npm wrapper process),
      // so pm2 manages a single clean child and signals propagate properly.
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
