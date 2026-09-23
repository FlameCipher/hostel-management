"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const schema=z.object({category:z.enum(["CARETAKER","ELECTRICITY","WATER","REPAIRS_MAINTENANCE","SECURITY","CLEANING","INTERNET","TAXES_LICENSES","SUPPLIES","OTHER"]),description:z.string().trim().min(2),amount:z.coerce.number().positive(),expenseDate:z.string().min(1),payee:z.string().trim().optional(),reference:z.string().trim().optional(),notes:z.string().trim().optional()});
export async function createExpenseAction(formData:FormData){const session=await requireSession(); const v=schema.parse(Object.fromEntries(formData)); await db.expense.create({data:{organizationId:session.organizationId,recordedById:session.userId,category:v.category,description:v.description,amount:v.amount,expenseDate:new Date(v.expenseDate+"T12:00:00.000Z"),payee:v.payee||null,reference:v.reference||null,notes:v.notes||null}}); await db.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"EXPENSE_RECORDED",entityType:"Expense",metadata:{category:v.category,amount:v.amount,description:v.description}}}); revalidatePath("/expenses"); redirect("/expenses");}
