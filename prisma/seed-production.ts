import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const ORGANIZATION_ID = "mama-mbugua-hostel";
const REQUIRED_CONFIRMATION = "MMAMBUGUA_HOSTEL";

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured.`);
  }

  return value;
}

function validateProductionInput() {
  const confirmation = requiredEnvironmentVariable("PRODUCTION_SEED_CONFIRM");

  if (confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Set PRODUCTION_SEED_CONFIRM=${REQUIRED_CONFIRMATION} to confirm that you intend to seed the production database.`,
    );
  }

  const connectionString = requiredEnvironmentVariable("PRODUCTION_DATABASE_URL");
  const parsedUrl = new URL(connectionString);

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("PRODUCTION_DATABASE_URL must be a PostgreSQL connection URL.");
  }

  if (["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)) {
    throw new Error("PRODUCTION_DATABASE_URL points to a local database, not production.");
  }

  const ownerEmail = requiredEnvironmentVariable("PRODUCTION_OWNER_EMAIL").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
    throw new Error("PRODUCTION_OWNER_EMAIL is not a valid email address.");
  }

  const ownerPassword = requiredEnvironmentVariable("PRODUCTION_OWNER_PASSWORD");
  if (ownerPassword.length < 12) {
    throw new Error("PRODUCTION_OWNER_PASSWORD must contain at least 12 characters.");
  }

  return {
    connectionString,
    ownerEmail,
    ownerPassword,
    ownerName: process.env.PRODUCTION_OWNER_NAME?.trim() || "Samuel Murigi Waigwa",
    ownerPhone: process.env.PRODUCTION_OWNER_PHONE?.trim() || "0714 464 701",
    organizationEmail: process.env.PRODUCTION_ORGANIZATION_EMAIL?.trim() || null,
    organizationAddress:
      process.env.PRODUCTION_ORGANIZATION_ADDRESS?.trim() ||
      "Near JKUAT Main Campus Gate B, Juja, Kiambu",
  };
}

async function main() {
  const input = validateProductionInput();
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: input.connectionString }),
  });

  try {
    const passwordHash = await hash(input.ownerPassword, 12);

    await db.$transaction(async (tx) => {
      await tx.organization.upsert({
        where: { id: ORGANIZATION_ID },
        update: {
          name: "MMAMBUGUA HOSTEL",
          ownerName: input.ownerName,
          phone: "0714464701",
          secondaryPhone: "0722634013",
          email: "samuelmwaigwa@gmail.com",
          physicalAddress: input.organizationAddress,
          receiptPrefix: "MMH",
          defaultSemesterMonths: 4,
          defaultBreakMonths: 3,
          reminderDaysBefore: 7,
          whatsappEnabled: true,
          smsEnabled: false,
        },
        create: {
          id: ORGANIZATION_ID,
          name: "MMAMBUGUA HOSTEL",
          ownerName: input.ownerName,
          phone: "0714464701",
          secondaryPhone: "0722634013",
          email: "samuelmwaigwa@gmail.com",
          physicalAddress: input.organizationAddress,
          receiptPrefix: "MMH",
          defaultSemesterMonths: 4,
          defaultBreakMonths: 3,
          reminderDaysBefore: 7,
          whatsappEnabled: true,
          smsEnabled: false,
        },
      });

      const [existingOwner, accountWithRequestedEmail] = await Promise.all([
        tx.user.findFirst({
          where: { organizationId: ORGANIZATION_ID, role: "OWNER" },
          orderBy: { createdAt: "asc" },
        }),
        tx.user.findUnique({
          where: {
            organizationId_email: {
              organizationId: ORGANIZATION_ID,
              email: input.ownerEmail,
            },
          },
        }),
      ]);

      if (
        existingOwner &&
        accountWithRequestedEmail &&
        existingOwner.id !== accountWithRequestedEmail.id
      ) {
        throw new Error(
          "The requested owner email belongs to another user. Change that account first or use a different email.",
        );
      }

      const ownerData = {
        name: input.ownerName,
        email: input.ownerEmail,
        phone: input.ownerPhone,
        passwordHash,
        role: "OWNER" as const,
        active: true,
      };

      if (existingOwner) {
        await tx.user.update({ where: { id: existingOwner.id }, data: ownerData });
      } else if (accountWithRequestedEmail) {
        await tx.user.update({
          where: { id: accountWithRequestedEmail.id },
          data: ownerData,
        });
      } else {
        await tx.user.create({
          data: {
            organizationId: ORGANIZATION_ID,
            ...ownerData,
          },
        });
      }

      const roomTypes = [
        {
          name: "Single Room Private",
          sharingMode: "PRIVATE" as const,
          monthlyRate: 4_500,
          semesterRate: 18_000,
          defaultCapacity: 1,
        },
        {
          name: "Single Room Shared",
          sharingMode: "SHARED" as const,
          monthlyRate: 3_500,
          semesterRate: 14_000,
          defaultCapacity: 2,
        },
        {
          name: "Bedsitter Private",
          sharingMode: "PRIVATE" as const,
          monthlyRate: 7_000,
          semesterRate: 28_000,
          defaultCapacity: 1,
        },
        {
          name: "Bedsitter Shared",
          sharingMode: "SHARED" as const,
          monthlyRate: 5_000,
          semesterRate: 20_000,
          defaultCapacity: 2,
        },
      ];

      for (const roomType of roomTypes) {
        await tx.roomType.upsert({
          where: {
            organizationId_name: {
              organizationId: ORGANIZATION_ID,
              name: roomType.name,
            },
          },
          update: { ...roomType, active: true },
          create: {
            organizationId: ORGANIZATION_ID,
            ...roomType,
            active: true,
          },
        });
      }
    });

    console.log("Production setup completed successfully.");
    console.log(`Organization: MMAMBUGUA HOSTEL (${ORGANIZATION_ID})`);
    console.log(`Owner login: ${input.ownerEmail}`);
    console.log("Accommodation types: 4 configured");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});