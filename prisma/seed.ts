import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

// Seeds one event per meeting type so the app is demoable immediately:
// open an event and click "Load sample for this meeting type".

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' }),
});

const hours = (n: number) => n * 60 * 60 * 1000;

async function main() {
  const existing = await prisma.calendarEvent.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} event(s) already present.`);
    return;
  }

  const now = Date.now();
  await prisma.calendarEvent.createMany({
    data: [
      {
        title: 'Expert call: SiC power semiconductors',
        meetingType: 'EXPERT_CALL',
        startTime: new Date(now - hours(26)),
        endTime: new Date(now - hours(25)),
        timezone: 'America/New_York',
        status: 'COMPLETED',
      },
      {
        title: 'Northwind Robotics pre-IPO roadshow',
        meetingType: 'ROADSHOW',
        startTime: new Date(now - hours(4)),
        endTime: new Date(now - hours(3)),
        timezone: 'Asia/Hong_Kong',
        status: 'COMPLETED',
      },
      {
        title: 'Weekly investment group call',
        meetingType: 'WEEKLY_GROUP_CALL',
        startTime: new Date(now + hours(20)),
        endTime: new Date(now + hours(21)),
        timezone: 'Europe/Amsterdam',
        status: 'SCHEDULED',
      },
    ],
  });
  console.log('Seeded 3 events (one per meeting type).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
