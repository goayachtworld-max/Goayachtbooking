import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/, "Must be a valid Indian number"),
  alternateContact: z.string()
    .regex(/^(?:\+91)?[6-9]\d{9}$/, "Must be a valid Alternate Indian number")
    .optional(),
  email: z.string().email("Invalid email"),
  bookingId: z.string().optional(), // will be added later
  // govtIdImage: z.string().url("Govt ID image must be a valid URL"),
  govtIdNo: z.string().regex(/^[A-Za-z0-9]+$/, "Govt ID must be alphanumeric").optional(),
});
