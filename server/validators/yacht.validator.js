import { z } from "zod";

export const yachtSchema = z.object({
  name: z.string().min(2, "Yacht name is required"),
  capacity: z.preprocess(
    (val) => (val !== undefined ? Number(val) : undefined),
    z.number().min(1, "Capacity must be at least 1")
  ),
  sailingCost: z.preprocess(
    (val) => (val !== undefined ? Number(val) : undefined),
    z.number().min(0)
  ),
  anchorageCost: z.preprocess(
    (val) => (val !== undefined ? Number(val) : undefined),
    z.number().min(0)
  ),
  runningCost: z.preprocess(
    (val) => (val !== undefined ? Number(val) : undefined),
    z.number().min(0)
  ),
  sellingPrice: z.preprocess(
    (val) => (val !== undefined ? Number(val) : undefined),
    z.number().min(0)
  ),
  maxSellingPrice: z.preprocess(
    (val) => (val !== undefined ? Number(val) : undefined),
    z.number().min(0)
  ),
  sailStartTime: z.string().regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "Start time must be HH:MM"
  ),
  sailEndTime: z.string().regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "End time must be HH:MM"
  ),
  duration: z.string().regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "Duration must be HH:MM"
  ),
  status: z.enum(["active", "inactive"]).optional(),
  company: z.string().optional(),
  yachtPhotos: z
    .union([
      z.array(z.string().url()),
      z.string().url(),
    ])
    .optional(),
  removedPhotos: z.preprocess(
    (val) => {
      if (!val) return [];
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    },
    z.array(z.string())
  ).optional(),
  specialSlotTimes: z.preprocess(
    (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    },
    z.array(z.string())
  ).optional(),
  boardingLocation: z.string().optional()
});
