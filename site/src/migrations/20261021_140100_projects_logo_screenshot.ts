import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Projects: optional `logo` and `screenshot` uploads (`logo_id`, `screenshot_id`), each a foreign key
 * to `media` with an index — the same shape as `posts.hero_image_id`. NULL = no upload; the site falls
 * back to the logo found on the project's site, then initials. No backfill.
 */

// SQLite has no `ADD COLUMN IF NOT EXISTS`, and a column may already be there: dev databases get it
// from schema push, or someone may have added it by hand. So check first.
async function hasColumn(db: MigrateUpArgs['db'], table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info(\`${table}\`)`))
  return (res.rows as any[]).some((r) => (r.name ?? r[1]) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'projects', 'logo_id'))) {
    await db.run(sql`ALTER TABLE \`projects\` ADD \`logo_id\` integer REFERENCES media(id) ON UPDATE no action ON DELETE set null;`)
  }
  if (!(await hasColumn(db, 'projects', 'screenshot_id'))) {
    await db.run(sql`ALTER TABLE \`projects\` ADD \`screenshot_id\` integer REFERENCES media(id) ON UPDATE no action ON DELETE set null;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`projects_logo_idx\` ON \`projects\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`projects_screenshot_idx\` ON \`projects\` (\`screenshot_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`projects_logo_idx\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`projects_screenshot_idx\`;`)
  await db.run(sql`ALTER TABLE \`projects\` DROP COLUMN \`logo_id\`;`)
  await db.run(sql`ALTER TABLE \`projects\` DROP COLUMN \`screenshot_id\`;`)
}
