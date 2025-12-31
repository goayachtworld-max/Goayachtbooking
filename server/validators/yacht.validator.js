// import { z } from "zod";

// export const yachtSchema = z.object({
//   name: z.string({ required_error: "Yacht name is required" }).min(2),

//   capacity: z.preprocess(
//     (val) => (val ? Number(val) : undefined),
//     z.number({ required_error: "Capacity is required" }).min(1)
//   ),

//   runningCost: z.preprocess(
//     (val) => (val ? Number(val) : undefined),
//     z.number({ required_error: "Running cost is required" }).min(0)
//   ),

//   sailingCost: z.preprocess(
//     (val) => (val ? Number(val) : undefined),
//     z.number({ required_error: "Sailing cost is required" }).min(0)
//   ),

//   anchorageCost: z.preprocess(
//     (val) => (val ? Number(val) : undefined),
//     z.number({ required_error: "Anchorage cost is required" }).min(0)
//   ),

//   maxSellingPrice: z.preprocess(
//     (val) => (val ? Number(val) : undefined),
//     z.number({ required_error: "Max selling price is required" }).min(0)
//   ),

//   sellingPrice: z.preprocess(
//     (val) => (val ? Number(val) : undefined),
//     z.number({ required_error: "Selling price is required" }).min(0)
//   ),
//   maxSellingPrice: z.preprocess((val) => Number(val), z.number()),
//   yachtPhotos: z
//     .array(z.string().url("Invalid photo URL"))
//     .optional(),

//   status: z.enum(["active", "inactive"]).default("active"),

//   company: z.string().optional(),
//   sailStartTime: z.string().min(1, "Start Time is required"),
//   sailEndTime: z.string().min(1, "End Time is required"),
//   duration: z.string().min(1, "Sail Duration is required"),
//   specialSlotTimes: z.preprocess(
//     (value) => {
//       if (Array.isArray(value)) return value;
//       if (!value) return [];
//       try {
//         return JSON.parse(value);
//       } catch {
//         return [];
//       }
//     },
//     z.array(z.string())
//   ).optional(),


// });


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

  /* ---------------- IMAGES ---------------- */

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

  /* ---------------- SPECIAL SLOTS ---------------- */

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
});
