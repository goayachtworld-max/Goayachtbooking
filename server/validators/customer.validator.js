import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/, "Must be a valid Indian number"),
  alternateContact: z.string().optional(),
  email: z.string().optional(),
  bookingId: z.string().optional(),
  govtIdNo: z.string().optional()
});
