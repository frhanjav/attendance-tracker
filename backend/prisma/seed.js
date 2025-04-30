"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const saltRounds = 10; // Match .env
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Start seeding ...`);
        // Clean existing data (optional)
        yield prisma.bulkAttendanceEntry.deleteMany();
        yield prisma.attendanceRecord.deleteMany();
        yield prisma.timetableEntry.deleteMany();
        yield prisma.timetable.deleteMany();
        yield prisma.streamMembership.deleteMany();
        yield prisma.stream.deleteMany();
        yield prisma.user.deleteMany();
        // Seed Users
        const hashedPassword = yield bcrypt_1.default.hash('password123', saltRounds);
        const user1 = yield prisma.user.create({
            data: {
                email: 'admin@example.com',
                password: hashedPassword,
                name: 'Admin User',
            },
        });
        const user2 = yield prisma.user.create({
            data: {
                email: 'student@example.com',
                password: hashedPassword,
                name: 'Student User',
            },
        });
        console.log(`Created users: ${user1.email}, ${user2.email}`);
        // Seed Stream
        const stream1 = yield prisma.stream.create({
            data: {
                name: 'B.Tech CSE 2024',
                ownerId: user1.id,
                // streamCode is auto-generated
            },
        });
        console.log(`Created stream: ${stream1.name} (Code: ${stream1.streamCode})`);
        // Seed Memberships (Admin is owner, also add student)
        yield prisma.streamMembership.create({
            data: { userId: user1.id, streamId: stream1.id, role: 'admin' },
        });
        yield prisma.streamMembership.create({
            data: { userId: user2.id, streamId: stream1.id, role: 'member' },
        });
        console.log(`Added members to stream ${stream1.name}`);
        // Seed Timetable
        const timetable1 = yield prisma.timetable.create({
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
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
//# sourceMappingURL=seed.js.map