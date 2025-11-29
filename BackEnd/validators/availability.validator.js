import { z } from "zod";

export const availabilitySchema = z.object({
    yachtId: z
        .string({ required_error: "Yacht ID is required" }),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Date must be a valid ISO date string"
    }),
    startTime: z
        .string({ required_error: "Start time is required" }),
    endTime: z
        .string({ required_error: "End time is required" }),
    status: z.enum(["available", "booked", "locked"], {
        required_error: "Status is required",
    }),
    lockExpiresAt: z.string().optional(), // if locked
    bookingId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid Booking ID")
        .optional(),
    lockedBy: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid Employee ID")
        .optional(),
});
