import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const organizationId = "mama-mbugua-hostel";
const activeSemesterName = "September to December 2026";
const on = (day: string) => new Date(`${day}T12:00:00.000Z`);
const slug = (value: string) => value.toLowerCase().replaceAll(" ", "-");

const people = [
  ["Jane Wanjiku", "0712010001", "SCT211-0001/2026", "Mary Wanjiku", "0722010001", "Mother"],
  ["Brian Kamau", "0712010002", "ENE211-0002/2026", "Peter Kamau", "0722010002", "Father"],
  ["Faith Njeri", "0712010003", "HDB211-0003/2026", "Lucy Njeri", "0722010003", "Mother"],
  ["Kevin Mwangi", "0712010004", "SMA211-0004/2026", "John Mwangi", "0722010004", "Father"],
  ["Mercy Akinyi", "0712010005", "BIT211-0005/2026", "Rose Akinyi", "0722010005", "Mother"],
  ["John Mutua", "0712010006", "MEC211-0006/2026", "David Mutua", "0722010006", "Father"],
  ["Grace Nyambura", "0712010007", "COM211-0007/2026", "Anne Nyambura", "0722010007", "Mother"],
  ["Peter Otieno", "0712010008", "ECE211-0008/2026", "George Otieno", "0722010008", "Father"],
  ["Sharon Chebet", "0712010009", "STA211-0009/2026", "Esther Chebet", "0722010009", "Mother"],
  ["David Kiptoo", "0712010010", "ICS211-0010/2026", "Daniel Kiptoo", "0722010010", "Father"],
  ["Alice Muthoni", "0712010011", "LAW211-0011/2026", "Jane Muthoni", "0722010011", "Mother"],
  ["Mark Maina", "0712010012", "BPS211-0012/2026", "Samuel Maina", "0722010012", "Father"],
  ["Ruth Wambui", "0712010013", "FST211-0013/2026", "Elizabeth Wambui", "0722010013", "Mother"],
  ["James Ochieng", "0712010014", "CIV211-0014/2026", "Joseph Ochieng", "0722010014", "Father"],
  ["Emily Waithera", "0712010015", "BBT211-0015/2026", "Margaret Waithera", "0722010015", "Mother"],
  ["Ann Wairimu", "0712010016", "MTH211-0016/2026", "Catherine Wairimu", "0722010016", "Aunt"],
  ["Samuel Karanja", "0712010017", "SCT211-0017/2025", "Paul Karanja", "0722010017", "Father"],
  ["Linda Atieno", "0712010018", "BIT211-0018/2025", "Monica Atieno", "0722010018", "Mother"],
] as const;

async function main() {
  const organization = await db.organization.upsert({
    where: { id: organizationId },
    update: { name: "Mama Mbugua Hostel", ownerName: "Samuel Murigi Waigwa", phone: "0714 464 701", email: "info@mamambugua.co.ke", physicalAddress: "Near JKUAT Main Campus, Juja, Kiambu", receiptPrefix: "MMH", defaultSemesterMonths: 4, defaultBreakMonths: 3, reminderDaysBefore: 7, mpesaShortcode: "123456", mpesaAccountName: "Mama Mbugua Hostel", whatsappEnabled: true, smsEnabled: false },
    create: { id: organizationId, name: "Mama Mbugua Hostel", ownerName: "Samuel Murigi Waigwa", phone: "0714 464 701", email: "info@mamambugua.co.ke", physicalAddress: "Near JKUAT Main Campus, Juja, Kiambu", receiptPrefix: "MMH", defaultSemesterMonths: 4, defaultBreakMonths: 3, reminderDaysBefore: 7, mpesaShortcode: "123456", mpesaAccountName: "Mama Mbugua Hostel", whatsappEnabled: true, smsEnabled: false },
  });
  const passwordHash = await hash("ChangeMe123!", 12);
  const userRows = [
    ["Samuel Murigi Waigwa", "owner@mamambugua.co.ke", "0714 464 701", "OWNER"],
    ["Rhoda Njeri", "admin@mamambugua.co.ke", "0712 555 101", "ADMIN"],
    ["Mary Wambui", "manager@mamambugua.co.ke", "0712 555 102", "MANAGER"],
    ["Joseph Kariuki", "caretaker@mamambugua.co.ke", "0712 555 103", "CARETAKER"],
  ] as const;
  const userIds = new Map<string, string>();
  for (const [name, email, phone, role] of userRows) {
    const user = await db.user.upsert({ where: { organizationId_email: { organizationId, email } }, update: { name, phone, role, active: true }, create: { organizationId, name, email, phone, role, active: true, passwordHash } });
    userIds.set(role, user.id);
  }
  const ownerId = userIds.get("OWNER")!;
  const adminId = userIds.get("ADMIN")!;

  const semesterRows = [
    ["January to April 2026", "2026-01-05", "2026-04-30", "CLOSED"],
    [activeSemesterName, "2026-09-01", "2026-12-31", "ACTIVE"],
    ["January to April 2027", "2027-01-04", "2027-04-30", "UPCOMING"],
  ] as const;
  const semesterIds = new Map<string, string>();
  for (const [name, start, end, status] of semesterRows) {
    const semester = await db.semester.upsert({ where: { organizationId_name: { organizationId, name } }, update: { startDate: on(start), endDate: on(end), months: 4, status }, create: { organizationId, name, startDate: on(start), endDate: on(end), months: 4, status } });
    semesterIds.set(name, semester.id);
  }
  const activeSemesterId = semesterIds.get(activeSemesterName)!;
  const previousSemesterId = semesterIds.get("January to April 2026")!;

  const types = [
    ["single-private", "Single Room Private", "PRIVATE", 4500, 18000, 1],
    ["single-shared", "Single Room Shared", "SHARED", 3500, 14000, 2],
    ["bedsitter-private", "Bedsitter Private", "PRIVATE", 7000, 28000, 1],
    ["bedsitter-shared", "Bedsitter Shared", "SHARED", 5000, 20000, 2],
  ] as const;
  const typeRate = new Map<string, number>();
  for (const [id, name, sharingMode, monthlyRate, semesterRate, defaultCapacity] of types) {
    await db.roomType.upsert({ where: { id }, update: { name, sharingMode, monthlyRate, semesterRate, defaultCapacity, active: true }, create: { id, organizationId, name, sharingMode, monthlyRate, semesterRate, defaultCapacity } });
    typeRate.set(id, semesterRate);
  }
  const roomIds = new Map<string, string>();
  const roomTypeFor = (number: number) => number <= 8 || number >= 22 ? "single-shared" : number <= 13 ? "bedsitter-shared" : number <= 18 ? "single-private" : "bedsitter-private";
  for (let number = 1; number <= 24; number += 1) {
    const roomTypeId = roomTypeFor(number);
    const room = await db.room.upsert({ where: { organizationId_number: { organizationId, number: String(number) } }, update: { roomTypeId, floor: number <= 12 ? "Ground" : "First", status: number === 24 ? "MAINTENANCE" : "VACANT", notes: number === 24 ? "Window repair scheduled before next intake." : null }, create: { organizationId, roomTypeId, number: String(number), floor: number <= 12 ? "Ground" : "First", status: number === 24 ? "MAINTENANCE" : "VACANT", notes: number === 24 ? "Window repair scheduled before next intake." : null } });
    roomIds.set(String(number), room.id);
  }

  const studentIds = new Map<string, string>();
  for (const [index, [fullName, phone, admissionNumber, guardianName, guardianPhone, relationship]] of people.entries()) {
    const status = index === 15 ? "SUSPENDED" : index >= 16 ? "CHECKED_OUT" : "ACTIVE";
    const student = await db.student.upsert({ where: { organizationId_admissionNumber: { organizationId, admissionNumber } }, update: { fullName, phone, status, guardian: { upsert: { create: { name: guardianName, phone: guardianPhone, relationship }, update: { name: guardianName, phone: guardianPhone, relationship } } } }, create: { organizationId, fullName, phone, university: "JKUAT", admissionNumber, nationalId: `35${670000 + index}`, admittedAt: on(index >= 16 ? "2025-09-01" : "2026-09-01"), status, notes: index === 15 ? "Suspended pending document verification." : null, guardian: { create: { name: guardianName, phone: guardianPhone, relationship } } } });
    studentIds.set(fullName, student.id);
  }

  const allocations = [["Jane Wanjiku", "1"], ["Brian Kamau", "1"], ["Faith Njeri", "2"], ["Kevin Mwangi", "2"], ["Mercy Akinyi", "3"], ["John Mutua", "3"], ["Grace Nyambura", "9"], ["Peter Otieno", "9"], ["Sharon Chebet", "10"], ["David Kiptoo", "10"], ["Alice Muthoni", "14"], ["Mark Maina", "15"], ["Ruth Wambui", "19"], ["James Ochieng", "20"]] as const;
  const occupancyIds = new Map<string, string>();
  const chargeIds = new Map<string, string>();
  for (const [name, roomNumber] of allocations) {
    const studentId = studentIds.get(name)!;
    const roomId = roomIds.get(roomNumber)!;
    const occupancy = await db.occupancy.upsert({ where: { semesterId_studentId: { semesterId: activeSemesterId, studentId } }, update: { roomId, status: "ACTIVE", checkedOutAt: null }, create: { organizationId, semesterId: activeSemesterId, studentId, roomId, checkInAt: on("2026-09-01"), expectedCheckoutAt: on("2026-12-31"), status: "ACTIVE", checkInCondition: "Room and issued items inspected in good condition.", clearanceStatus: "PENDING" } });
    occupancyIds.set(name, occupancy.id);
    const chargeId = `seed-charge-${slug(name)}`;
    const amount = typeRate.get(roomTypeFor(Number(roomNumber)))!;
    await db.charge.upsert({ where: { id: chargeId }, update: { occupancyId: occupancy.id, amount, dueDate: on("2026-09-05") }, create: { id: chargeId, organizationId, semesterId: activeSemesterId, studentId, occupancyId: occupancy.id, type: "SEMESTER_RENT", description: `${activeSemesterName} rent · Room ${roomNumber}`, amount, dueDate: on("2026-09-05"), status: "UNPAID" } });
    chargeIds.set(name, chargeId);
  }
  for (const [name, roomNumber, checkout] of [["Samuel Karanja", "4", "2026-04-29"], ["Linda Atieno", "5", "2026-04-30"]] as const) {
    const occupancy = await db.occupancy.upsert({ where: { semesterId_studentId: { semesterId: previousSemesterId, studentId: studentIds.get(name)! } }, update: { status: "CHECKED_OUT", checkedOutAt: on(checkout), clearanceStatus: "CLEARED" }, create: { organizationId, semesterId: previousSemesterId, studentId: studentIds.get(name)!, roomId: roomIds.get(roomNumber)!, checkInAt: on("2026-01-05"), expectedCheckoutAt: on("2026-04-30"), checkedOutAt: on(checkout), status: "CHECKED_OUT", checkInCondition: "Good", checkoutCondition: "Good", clearanceStatus: "CLEARED", finalBalance: 0 } });
    occupancyIds.set(name, occupancy.id);
  }

  const payments = [
    ["Jane Wanjiku", 14000, "MPESA", "TAA11MMH01"], ["Brian Kamau", 7000, "MPESA", "TAA11MMH02"], ["Kevin Mwangi", 14000, "CASH", null],
    ["Mercy Akinyi", 8000, "MPESA", "TAA11MMH04"], ["John Mutua", 14000, "BANK_TRANSFER", "EQB-260901-15"], ["Grace Nyambura", 20000, "MPESA", "TAA11MMH06"],
    ["Sharon Chebet", 10000, "MPESA", "TAA11MMH07"], ["David Kiptoo", 20000, "MPESA", "TAA11MMH08"], ["Alice Muthoni", 18000, "CASH", null],
    ["Mark Maina", 9000, "MPESA", "TAA11MMH10"], ["James Ochieng", 28000, "MPESA", "TAA11MMH11"],
  ] as const;
  const paymentIds = new Map<string, string>();
  for (const [index, [name, amount, method, reference]] of payments.entries()) {
    const receiptNumber = `MMH-2026-${String(index + 1).padStart(5, "0")}`;
    const payment = await db.payment.upsert({ where: { organizationId_receiptNumber: { organizationId, receiptNumber } }, update: { amount, method, reference, reversedAt: null, reversedById: null, reversalReason: null, reversalType: null }, create: { organizationId, studentId: studentIds.get(name)!, chargeId: chargeIds.get(name)!, recordedById: index % 2 ? adminId : ownerId, amount, paidAt: on(`2026-09-${String(index + 1).padStart(2, "0")}`), method, reference, receiptNumber, notes: index === 1 ? "First instalment." : null } });
    paymentIds.set(receiptNumber, payment.id);
    const charge = await db.charge.findUniqueOrThrow({ where: { id: chargeIds.get(name)! } });
    await db.charge.update({ where: { id: charge.id }, data: { status: amount >= Number(charge.amount) ? "FULLY_PAID" : "OVERDUE" } });
  }
  const reversed = await db.payment.upsert({ where: { organizationId_receiptNumber: { organizationId, receiptNumber: "MMH-2026-00012" } }, update: { reversedAt: on("2026-09-04"), reversedById: ownerId, reversalReason: "Customer confirmed a completed M-Pesa reversal.", reversalType: "MPESA_CONFIRMED" }, create: { organizationId, studentId: studentIds.get("Faith Njeri")!, chargeId: chargeIds.get("Faith Njeri")!, recordedById: adminId, reversedById: ownerId, amount: 5000, paidAt: on("2026-09-03"), method: "MPESA", reference: "TAA11REV12", receiptNumber: "MMH-2026-00012", reversedAt: on("2026-09-04"), reversalReason: "Customer confirmed a completed M-Pesa reversal.", reversalType: "MPESA_CONFIRMED" } });
  paymentIds.set("MMH-2026-00012", reversed.id);
  await db.receiptSequence.upsert({ where: { organizationId_year: { organizationId, year: 2026 } }, update: { lastIssued: 12 }, create: { organizationId, year: 2026, lastIssued: 12 } });

  const mpesaRows = [
    ["TAA11MMH01", "MMH-2026-00001", 14000, "MATCHED"], ["TAA11MMH02", "MMH-2026-00002", 7000, "MATCHED"], ["TAA11MMH04", "MMH-2026-00004", 8000, "MATCHED"],
    ["TAA11MMH06", "MMH-2026-00006", 20000, "MATCHED"], ["TAA11MMH07", null, 9000, "AMOUNT_MISMATCH"], ["TAA11MMH99", null, 3500, "UNMATCHED"], ["TAA11REV12", "MMH-2026-00012", 5000, "REVERSED"],
  ] as const;
  for (const [code, receipt, amount, status] of mpesaRows) await db.mpesaTransaction.upsert({ where: { organizationId_transactionCode: { organizationId, transactionCode: code } }, update: { paymentId: receipt ? paymentIds.get(receipt)! : null, amount, status, matchedAt: status === "MATCHED" ? on("2026-09-05") : null }, create: { organizationId, paymentId: receipt ? paymentIds.get(receipt)! : null, transactionCode: code, phone: "254712010001", amount, transactedAt: on("2026-09-03"), reference: receipt ?? "UNKNOWN", source: "CSV", status, matchedAt: status === "MATCHED" ? on("2026-09-05") : null, notes: status === "AMOUNT_MISMATCH" ? "Reference matches a payment but the amounts differ." : status === "UNMATCHED" ? "No ledger payment uses this transaction code." : null, rawData: { seeded: true } } });

  const properties = [["Jane Wanjiku", "Laptop", "LAPTOP", "HP laptop and charger"], ["Jane Wanjiku", "Suitcase", "SUITCASE", "Black medium suitcase"], ["Brian Kamau", "Bicycle", "BICYCLE", "Blue mountain bicycle"], ["Grace Nyambura", "Mattress", "MATTRESS", "4x6 mattress"], ["Alice Muthoni", "Laptop", "LAPTOP", "Dell laptop and charger"], ["James Ochieng", "Television", "ELECTRONICS", "32-inch television"]] as const;
  for (const [index, [name, itemName, category, description]] of properties.entries()) await db.studentPropertyItem.upsert({ where: { id: `seed-property-${index + 1}` }, update: { name: itemName, category, description }, create: { id: `seed-property-${index + 1}`, occupancyId: occupancyIds.get(name)!, name: itemName, category, description, checkInCondition: "GOOD", notes: "Recorded at check-in." } });

  for (const roomNumber of ["1", "2", "3", "9", "10", "14", "15", "19", "20"]) {
    const capacity = ["14", "15", "19", "20"].includes(roomNumber) ? 1 : 2;
    for (const [suffix, name, category, quantity] of [["BED", "Bed", "BED", capacity], ["CHAIR", "Chair", "CHAIR", capacity], ["KEY", "Room key", "KEY", capacity]] as const) {
      const assetCode = `RM${roomNumber.padStart(2, "0")}-${suffix}`;
      await db.hostelAsset.upsert({ where: { organizationId_assetCode: { organizationId, assetCode } }, update: { roomId: roomIds.get(roomNumber), quantity }, create: { organizationId, roomId: roomIds.get(roomNumber), name, category, assetCode, quantity, condition: roomNumber === "10" && suffix === "CHAIR" ? "DAMAGED" : "GOOD", notes: roomNumber === "10" && suffix === "CHAIR" ? "One chair requires repair." : null } });
    }
  }

  const breakPeriod = await db.breakPeriod.upsert({ where: { organizationId_name: { organizationId, name: "May to August 2026 Break" } }, update: { status: "CLOSED" }, create: { organizationId, name: "May to August 2026 Break", startDate: on("2026-05-01"), endDate: on("2026-08-31"), months: 3, status: "CLOSED" } });
  for (const [name, roomNumber, intent, status, belongingsStored] of [["Jane Wanjiku", "1", "RETURNING", "RETURN_CONFIRMED", false], ["Sharon Chebet", "10", "RETURNING", "CHARGED", true], ["Samuel Karanja", "4", "NOT_RETURNING", "VACATED_CLEARED", false], ["Linda Atieno", "5", "NOT_RETURNING", "VACATED_CLEARED", false]] as const) await db.breakReservation.upsert({ where: { breakPeriodId_studentId: { breakPeriodId: breakPeriod.id, studentId: studentIds.get(name)! } }, update: { intent, status, belongingsStored }, create: { organizationId, breakPeriodId: breakPeriod.id, studentId: studentIds.get(name)!, roomId: roomIds.get(roomNumber)!, intent, status, belongingsStored, monthlyRateSnapshot: roomNumber === "10" ? 5000 : 3500, potentialCharge: belongingsStored ? 15000 : 0, declaredAt: on("2026-04-15"), clearedAt: status === "VACATED_CLEARED" ? on("2026-04-30") : null, returnConfirmedAt: status === "RETURN_CONFIRMED" ? on("2026-09-01") : null, notes: belongingsStored ? "Belongings remained in the room during break." : "No belongings stored during break." } });

  const sharonReservation = await db.breakReservation.findUniqueOrThrow({ where: { breakPeriodId_studentId: { breakPeriodId: breakPeriod.id, studentId: studentIds.get("Sharon Chebet")! } } });
  const breakCharge = await db.charge.upsert({ where: { id: "seed-break-charge-sharon" }, update: { breakReservationId: sharonReservation.id, amount: 15000, status: "FULLY_PAID" }, create: { id: "seed-break-charge-sharon", organizationId, studentId: studentIds.get("Sharon Chebet")!, breakReservationId: sharonReservation.id, type: "BREAK_ACCOMMODATION", description: "May to August 2026 belongings accommodation · Room 10", amount: 15000, dueDate: on("2026-09-01"), status: "FULLY_PAID" } });
  await db.payment.upsert({ where: { organizationId_receiptNumber: { organizationId, receiptNumber: "MMH-2026-00013" } }, update: { amount: 15000, chargeId: breakCharge.id }, create: { organizationId, studentId: studentIds.get("Sharon Chebet")!, chargeId: breakCharge.id, recordedById: ownerId, amount: 15000, paidAt: on("2026-09-01"), method: "BANK_TRANSFER", reference: "BREAK-ACCOM-2026-09", receiptNumber: "MMH-2026-00013", notes: "Settlement for belongings stored during the break before move-out." } });
  await db.receiptSequence.update({ where: { organizationId_year: { organizationId, year: 2026 } }, data: { lastIssued: 13 } });

  const notificationRows = [["seed-notification-1", "Faith Njeri", "WHATSAPP", "GUARDIAN", "QUEUED", "Reminder: Faith has an outstanding hostel balance. Please contact the office."], ["seed-notification-2", "Brian Kamau", "SMS", "STUDENT", "SENT", "Your hostel balance is due. Please arrange payment with the office."], ["seed-notification-3", "Peter Otieno", "WHATSAPP", "STUDENT", "OPENED_FOR_SENDING", "Your semester rent remains outstanding. Please contact Mama Mbugua Hostel."]] as const;
  for (const [id, name, channel, recipientType, status, message] of notificationRows) {
    const person = people.find((entry) => entry[0] === name)!;
    await db.notification.upsert({ where: { id }, update: { status, message }, create: { id, organizationId, studentId: studentIds.get(name), createdById: adminId, channel, recipientType, recipientName: recipientType === "GUARDIAN" ? person[3] : person[0], recipientPhone: recipientType === "GUARDIAN" ? person[4] : person[1], message, status, openedAt: status === "OPENED_FOR_SENDING" ? on("2026-09-08") : null, sentAt: status === "SENT" ? on("2026-09-07") : null } });
  }

  for (const [roomNumber, roomId] of roomIds) {
    if (roomNumber === "24") continue;
    const room = await db.room.findUniqueOrThrow({ where: { id: roomId }, include: { roomType: true, _count: { select: { occupancies: { where: { status: "ACTIVE" } } } } } });
    const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
    await db.room.update({ where: { id: roomId }, data: { status: room._count.occupancies === 0 ? "VACANT" : room._count.occupancies >= capacity ? "FULL" : "PARTIALLY_OCCUPIED" } });
  }
  await db.auditLog.upsert({ where: { id: "seed-audit-comprehensive" }, update: { metadata: { students: people.length, rooms: roomIds.size, activeSemester: activeSemesterName } }, create: { id: "seed-audit-comprehensive", organizationId, actorUserId: ownerId, action: "DEMO_DATA_SEEDED", entityType: "Organization", entityId: organization.id, metadata: { students: people.length, rooms: roomIds.size, activeSemester: activeSemesterName } } });
  console.log("Comprehensive seed complete: 18 students, 24 rooms, finance, assets, property, breaks and reminders.");
  console.log("Login: owner@mamambugua.co.ke / ChangeMe123!");
}

main().then(async () => db.$disconnect()).catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });
