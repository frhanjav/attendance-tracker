// // backend/src/types/express.d.ts
// import { User as PrismaUser } from '@prisma/client'; // Or your custom minimal type

// // Re-declare the Express namespace
// declare global {
//   namespace Express {
//     interface Request {
//       // Define user with the type your 'protect' middleware actually attaches
//       user?: PrismaUser; // Or AuthenticatedUser, etc.
//     }
//   }
// }
// // You might need to export something empty if TS complains about modules
// // export {};