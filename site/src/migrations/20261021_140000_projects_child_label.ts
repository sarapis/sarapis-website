import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Projects: "Children are called" (`child_label`) — what a parent project's children are named on
 * the site: 'subprojects' | 'features' | 'integrations'. Nullable text; empty means "subprojects".
 */

// SQLite has no `ADD COLUMN IF NOT EXISTS`, and a column may already be there: dev databases get it
// from schema push, or someone may have added it by hand. So check first.
async function hasColumn(db: MigrateUpArgs['db'], table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info(\`${table}\`)`))
  return (res.rows as any[]).some((r) => (r.name ?? r[1]) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'projects', 'child_label'))) {
    await db.run(sql`ALTER TABLE \`projects\` ADD \`child_label\` text DEFAULT 'subprojects';`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`projects\` DROP COLUMN \`child_label\`;`)
}
