import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Homepage global, board-of-directors array: optional `portrait` upload (`homepage_board.portrait_id`),
 * a foreign key to `media` with an index. NULL = no upload; /about falls back to the photo shipped in
 * public/board/, then an empty card. No backfill.
 */

// SQLite has no `ADD COLUMN IF NOT EXISTS`, and a column may already be there: dev databases get it
// from schema push, or someone may have added it by hand. So check first.
async function hasColumn(db: MigrateUpArgs['db'], table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info(\`${table}\`)`))
  return (res.rows as any[]).some((r) => (r.name ?? r[1]) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'homepage_board', 'portrait_id'))) {
    await db.run(sql`ALTER TABLE \`homepage_board\` ADD \`portrait_id\` integer REFERENCES media(id) ON UPDATE no action ON DELETE set null;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`homepage_board_portrait_idx\` ON \`homepage_board\` (\`portrait_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`homepage_board_portrait_idx\`;`)
  await db.run(sql`ALTER TABLE \`homepage_board\` DROP COLUMN \`portrait_id\`;`)
}
