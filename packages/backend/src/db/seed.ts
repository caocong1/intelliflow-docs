import { db } from './index';
import { users } from './schema';

async function seed() {
  console.log('Seeding database...');

  const passwordHash = await Bun.password.hash('admin123', {
    algorithm: 'argon2id',
  });

  const result = await db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash,
      displayName: 'System Administrator',
      role: 'admin',
      isActive: true,
    })
    .onConflictDoNothing({ target: users.username })
    .returning({ id: users.id, username: users.username });

  if (result.length > 0) {
    console.log('Default admin user created:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  Role: admin');
  } else {
    console.log('Admin user already exists, skipping.');
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
