import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10; // Match .env

async function main() {
  console.log(`Start seeding ...`);

  // Clean existing data (optional)
  await prisma.bulkAttendanceEntry.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.streamMembership.deleteMany();
  await prisma.stream.deleteMany();
  await prisma.user.deleteMany();

  // Seed Users
  const hashedPassword = await bcrypt.hash('password123', saltRounds);
  const user1 = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
    },
  });
  const user2 = await prisma.user.create({
    data: {
      email: 'student@example.com',
      password: hashedPassword,
      name: 'Student User',
    },
  });
  console.log(`Created users: ${user1.email}, ${user2.email}`);

  // Seed Stream
  const stream1 = await prisma.stream.create({
    data: {
      name: 'B.Tech CSE 2024',
      ownerId: user1.id,
      // streamCode is auto-generated
    },
  });
  console.log(`Created stream: ${stream1.name} (Code: ${stream1.streamCode})`);

  // Seed Memberships (Admin is owner, also add student)
  await prisma.streamMembership.create({
    data: { userId: user1.id, streamId: stream1.id, role: 'admin' },
  });
  await prisma.streamMembership.create({
    data: { userId: user2.id, streamId: stream1.id, role: 'member' },
  });
  console.log(`Added members to stream ${stream1.name}`);

  // Seed Timetable
  const timetable1 = await prisma.timetable.create({
      data: {
          streamId: stream1.id,
          name: "Semester 1",
          validFrom: new Date("2024-01-15T00:00:00.000Z"), // Use ISO strings or Date objects
          validUntil: new Date("2024-05-15T00:00:00.000Z"),
          entries: {
              create: [
                  // Monday
                  { dayOfWeek: 1, subjectName: "Data Structures", courseCode: "CS201" },
                  { dayOfWeek: 1, subjectName: "Algorithms", courseCode: "CS202" },
                  // Wednesday
                  { dayOfWeek: 3, subjectName: "Data Structures", courseCode: "CS201" },
                  { dayOfWeek: 3, subjectName: "Operating Systems", courseCode: "CS301" },
                  // Friday
                  { dayOfWeek: 5, subjectName: "Algorithms", courseCode: "CS202" },
                  { dayOfWeek: 5, subjectName: "Operating Systems", courseCode: "CS301" },
              ]
          }
      }
  });
  console.log(`Created timetable: ${timetable1.name}`);


  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });