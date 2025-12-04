import { z } from 'zod';

export const bookingSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  employeeId: z.string().optional(),
  transactionIds: z.array(z.string()).optional(), // array of ObjectIds
  yachtId: z.string().min(1, "Yaut Id required"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Date must be a valid ISO date string"
  }),
  duration: z.string().min(1, "Time is required").optional(), // Could use regex if fixed format (HH:mm)
  startTime: z.string().min(1, "Start Time is required"),
  endTime: z.string().min(1, "Start Time is required"),
  quotedAmount: z.number().min(0, "Quoted amount must be >= 0"),
  status: z.enum(["initiated", "inprogress", "success", "terminated"]).optional(),
  numPeople : z.number().min(1, "Number of people must be >= 0")
});
