import { z } from "zod";

export const yachtSchema = z.object({
  name: z.string({ required_error: "Yacht name is required" }).min(2),

  capacity: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number({ required_error: "Capacity is required" }).min(1)
  ),

  runningCost: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number({ required_error: "Running cost is required" }).min(0)
  ),

  maxSellingPrice: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number({ required_error: "Max selling price is required" }).min(0)
  ),

  sellingPrice: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number({ required_error: "Selling price is required" }).min(0)
  ),
  maxSellingPrice: z.preprocess((val) => Number(val), z.number()),
  yachtPhotos: z
    .array(z.string().url("Invalid photo URL"))
    .optional(),

  status: z.enum(["active", "inactive"]).default("active"),

  company: z.string().optional(),
  sailStartTime: z.string().min(1, "Start Time is required"),
  sailEndTime: z.string().min(1, "End Time is required"),
  duration: z.string().min(1, "Sail Duration is required"),
  specialSlotTimes: z.preprocess(
    (value) => {
      if (Array.isArray(value)) return value;
      if (!value) return [];
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    },
    z.array(z.string())
  ).optional(),


});
