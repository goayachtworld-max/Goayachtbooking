import { z } from 'zod';

export const employeeSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  name: z.string().min(1, "Name is required"),
  contact: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/, "Must be a valid Indian number"),
  alternateContact: z.string()
    .regex(/^(?:\+91)?[6-9]\d{9}$/, "Must be a valid Indian number")
    .optional(),
  email: z.string().email("Invalid email"),
  type: z.enum(["admin", "backdesk", "onsite"]),
  status: z.enum(["active", "inactive"]).default("active"),
});
