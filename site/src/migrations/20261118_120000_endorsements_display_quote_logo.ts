import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Campaign endorsements, for ospo.opensource.nyc: public-display consent (`display_publicly`), a message
 * of support (`quote`), the logo link an organization submits (`logo_url`) and the logo an approver
 * attaches (`logo_id`, a foreign key to `media` with an index — the same shape as `projects.logo_id`).
 *
 * All nullable, no backfill: `display_publicly` is deliberately left NULL on existing rows, which the
 * read rule treats as "shown" (they were submitted before the question existed).
 */

// SQLite has no `ADD COLUMN IF NOT EXISTS`, and a column may already be there: dev databases get it
// from schema push, or someone may have added it by hand. So check first.
async function hasColumn(db: MigrateUpArgs['db'], table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info(\`${table}\`)`))
  return (res.rows as any[]).some((r) => (r.name ?? r[1]) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'campaign_endorsements', 'display_publicly'))) {
    await db.run(sql`ALTER TABLE \`campaign_endorsements\` ADD \`display_publicly\` integer;`)
  }
  if (!(await hasColumn(db, 'campaign_endorsements', 'quote'))) {
    await db.run(sql`ALTER TABLE \`campaign_endorsements\` ADD \`quote\` text;`)
  }
  if (!(await hasColumn(db, 'campaign_endorsements', 'logo_url'))) {
    await db.run(sql`ALTER TABLE \`campaign_endorsements\` ADD \`logo_url\` text;`)
  }
  if (!(await hasColumn(db, 'campaign_endorsements', 'logo_id'))) {
    await db.run(sql`ALTER TABLE \`campaign_endorsements\` ADD \`logo_id\` integer REFERENCES media(id) ON UPDATE no action ON DELETE set null;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`campaign_endorsements_logo_idx\` ON \`campaign_endorsements\` (\`logo_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`campaign_endorsements_logo_idx\`;`)
  await db.run(sql`ALTER TABLE \`campaign_endorsements\` DROP COLUMN \`logo_id\`;`)
  await db.run(sql`ALTER TABLE \`campaign_endorsements\` DROP COLUMN \`logo_url\`;`)
  await db.run(sql`ALTER TABLE \`campaign_endorsements\` DROP COLUMN \`quote\`;`)
  await db.run(sql`ALTER TABLE \`campaign_endorsements\` DROP COLUMN \`display_publicly\`;`)
}
