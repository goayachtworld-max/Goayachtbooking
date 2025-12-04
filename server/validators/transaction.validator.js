import { z } from "zod";

export const transactionSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId"),
  employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId").optional(),
  type: z.enum(["advance", "settlement"]),
  paymentProof: z.string().url("Payment proof must be a valid URL"),
  amount: z.number().min(0, "Amount cannot be negative"),
  status: z.string().optional(),
  date: z.string().optional(),
});
