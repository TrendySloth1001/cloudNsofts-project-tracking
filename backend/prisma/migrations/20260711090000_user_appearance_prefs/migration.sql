-- Per-user appearance preferences (Settings → Appearance). New enums + two
-- columns on users, both with defaults so existing rows need no backfill.
CREATE TYPE "AppTheme" AS ENUM ('light', 'dark');
CREATE TYPE "AppDensity" AS ENUM ('comfortable', 'compact');

ALTER TABLE "users"
  ADD COLUMN "theme" "AppTheme" NOT NULL DEFAULT 'light',
  ADD COLUMN "density" "AppDensity" NOT NULL DEFAULT 'comfortable';
