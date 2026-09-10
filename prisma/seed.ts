import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const organization = await db.organization.upsert({
    where: { id: "mama-mbugua-hostel" },
    update: { name: "Mama Mbugua Hostel", ownerName: "Samuel Murigi Waigwa", phone: "0714 464 701" },
    create: { id: "mama-mbugua-hostel", name: "Mama Mbugua Hostel", ownerName: "Samuel Murigi Waigwa", phone: "0714 464 701" },
  });

  await db.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "owner@mamambugua.co.ke" } },
    update: { name: "Samuel Murigi Waigwa", active: true, role: "OWNER" },
    create: {
      organizationId: organization.id,
      name: "Samuel Murigi Waigwa",
      email: "owner@mamambugua.co.ke",
      phone: "0714 464 701",
      passwordHash: await hash("ChangeMe123!", 12),
      role: "OWNER",
    },
  });

  await db.semester.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "September to December 2026" } },
    update: { status: "ACTIVE" },
    create: {
      organizationId: organization.id,
      name: "September to December 2026",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.999Z"),
      months: 4,
      status: "ACTIVE",
    },
  });

  const types = [
    { id: "single-private", name: "Single Room Private", sharingMode: "PRIVATE" as const, monthlyRate: 4500, semesterRate: 18000, defaultCapacity: 1 },
    { id: "single-shared", name: "Single Room Shared", sharingMode: "SHARED" as const, monthlyRate: 3500, semesterRate: 14000, defaultCapacity: 2 },
    { id: "bedsitter-private", name: "Bedsitter Private", sharingMode: "PRIVATE" as const, monthlyRate: 7000, semesterRate: 28000, defaultCapacity: 1 },
    { id: "bedsitter-shared", name: "Bedsitter Shared", sharingMode: "SHARED" as const, monthlyRate: 5000, semesterRate: 20000, defaultCapacity: 2 },
  ];

  for (const type of types) {
    await db.roomType.upsert({
      where: { id: type.id },
      update: type,
      create: { ...type, organizationId: organization.id },
    });
  }

  for (let roomNumber = 1; roomNumber <= 24; roomNumber += 1) {
    const roomTypeId = roomNumber <= 8 ? "single-shared" : roomNumber <= 13 ? "bedsitter-shared" : roomNumber <= 18 ? "single-private" : roomNumber <= 21 ? "bedsitter-private" : "single-shared";
    await db.room.upsert({
      where: { organizationId_number: { organizationId: organization.id, number: String(roomNumber) } },
      update: { roomTypeId },
      create: { organizationId: organization.id, roomTypeId, number: String(roomNumber), floor: roomNumber <= 12 ? "Ground" : "First" },
    });
  }
}

main()
  .then(async () => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
