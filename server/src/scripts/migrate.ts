import _knex from '../db/knex';

const COMMANDS = ['latest', 'rollback', 'status'] as const;
type Command = typeof COMMANDS[number];

async function main() {
  const command = (process.argv[2] ?? 'latest') as Command;

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.error(`Usage: migrate [${COMMANDS.join('|')}]`);
    process.exit(1);
  }

  try {
    switch (command) {
      case 'latest': {
        const [batchNo, migrations] = await _knex.migrate.latest();
        if (migrations.length === 0) {
          console.log('Already up to date.');
        } else {
          console.log(`Batch ${batchNo} run: ${migrations.length} migration(s)`);
          (migrations as string[]).forEach(m => console.log(`  + ${m}`));
        }
        break;
      }
      case 'rollback': {
        const [batchNo, migrations] = await _knex.migrate.rollback();
        if (migrations.length === 0) {
          console.log('Nothing to rollback.');
        } else {
          console.log(`Rolled back batch ${batchNo}: ${migrations.length} migration(s)`);
          (migrations as string[]).forEach(m => console.log(`  - ${m}`));
        }
        break;
      }
      case 'status': {
        const [done, pending] = await _knex.migrate.list();
        console.log(`Completed (${done.length}):`);
        (done as any[]).forEach(m => console.log(`  + ${m.name ?? m}`));
        console.log(`Pending (${(pending as any[]).length}):`);
        (pending as any[]).forEach(m => console.log(`  - ${m.file ?? m}`));
        break;
      }
    }
  } finally {
    await _knex.destroy();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
