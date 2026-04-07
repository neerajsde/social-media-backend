import { z } from "zod";
import { validationInput } from "../../utils/validation.js";

export const marketPlaceSchema = z.object({
  title: z
    .string({ message: "Title required." })
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title max 100 characters"),

  description: z
    .string({ message: "Description required." })
    .trim()
    .min(10, "Description must be at least 10 characters"),

  price: z.coerce.number().positive("Price must be greater than 0"),

  category: z
    .string({ message: "Category required." })
    .trim()
    .min(1, "Category is required"),

  subCategory: z
    .string({ message: "Subcategory required." })
    .trim()
    .min(1, "Subcategory is required"),

  totalQty: z.coerce
    .number()
    .positive("Price must be greater than 0")
    .int("Quantity must be an integer")
    .min(0, "Quantity cannot be negative"),
});

export const marketPlaceValidation = validationInput(marketPlaceSchema);
