import { z } from 'zod';

export const demandSchema = z.object({
    customerName: z.string().trim().optional(),
    customerId:   z.string().optional(),
    agentName:    z.string().trim().optional(),
    agentId:      z.string().optional(),
    yachtName:    z.string().trim().optional(),
    yachtId:      z.string().optional(),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Date must be a valid ISO date string'
    }),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
        message: 'Time must be in HH:MM (24-hour) format'
    }),
    notes:  z.string().trim().optional(),
    status: z.enum(['open', 'converted', 'closed']).optional(),
}).refine(
    (data) => !!(data.customerName?.trim() || data.agentName?.trim()),
    { message: 'At least one of customerName or agentName is required' }
);