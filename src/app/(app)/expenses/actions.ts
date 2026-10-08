"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { validAmount } from "@/lib/currency";
import { organizationCurrency } from "@/lib/organization-currency";
import { db } from "@/lib/db";

const schema=z.object({category:z.enum(["CARETAKER","ELECTRICITY","WATER","REPAIRS_MAINTENANCE","SECURITY","CLEANING","INTERNET","TAXES_LICENSES","SUPPLIES","OTHER"]),description:z.string().trim().min(2),amount:z.coerce.number().positive().max(100000000),expenseDate:z.string().date(),payee:z.string().trim().optional(),reference:z.string().trim().optional(),notes:z.string().trim().optional()});
export async function createExpenseAction(formData: FormData) {
 const session = await requireSession();
 if (session.role === "CARETAKER") redirect("/expenses");
 const currency = await organizationCurrency(session.organizationId);
 const parsed = schema.safeParse(Object.fromEntries(formData));
 if (!parsed.success || formData.get("currency") !== currency || !validAmount(parsed.data.amount, currency)) redirect("/expenses/new?error=invalid");
 const v = parsed.data;
 try {
  await db.$transaction(async tx => {
   const expense = await tx.expense.create({data:{organizationId:session.organizationId,currency,recordedById:session.userId,category:v.category,description:v.description,amount:v.amount,expenseDate:new Date(v.expenseDate+"T12:00:00.000Z"),payee:v.payee||null,reference:v.reference||null,notes:v.notes||null}});
   await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"EXPENSE_RECORDED",entityType:"Expense",entityId:expense.id,metadata:{currency,category:v.category,amount:v.amount,description:v.description}}});
  });
 } catch { redirect("/expenses/new?error=invalid"); }
 revalidatePath("/expenses"); redirect("/expenses");
}
