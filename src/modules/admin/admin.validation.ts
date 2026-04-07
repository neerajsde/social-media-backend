import { z } from "zod";
import { validationInput } from "../../utils/validation.js";

const loginSchema = z.object({
  identifier: z
    .string("Username or email is required")
    .max(100, "Invaild email or username"),
  password: z.string("Password is required").max(100, "Invaild Password"),
});

const tokenSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\-_]+$/, "Invalid token format")
    .min(32, "Token is too short")
    .max(128, "Token is too long"),
});

const LoginOtpVerify = tokenSchema.extend({
  otp: z.string("OTP is required").length(6, "Invaild OTP"),
});

const adminRoleSchema = z.enum(["admin", "moderator", "support", "user"]);

const adminPermissionSchema = z.enum([
  "manage_users",
  "manage_content",
  "view_reports",
  "manage_settings",
]);

const assignAdminSchema = z.object({
  userId: z.string("User id is required"),
  role: adminRoleSchema,
  permissions: z.array(adminPermissionSchema).default([]),
});

const adminTargetSchema = z.object({
  sourceAdminId: z.string("Target admin id is required"),
});

export const loginValidation = validationInput(loginSchema);
export const loginOTPVerificationVal = validationInput(LoginOtpVerify);
export const assignAdminValidation = validationInput(assignAdminSchema);
export const activateAdminValidation = validationInput(adminTargetSchema);
export const approveAdminValidation = validationInput(adminTargetSchema);
