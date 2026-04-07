import { z } from "zod";
import { validationInput } from "../../utils/validation.js";

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9._]{2,29}$/),
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const registerSchema = usernameSchema
  .extend({
    email: z.email("Email is required").trim().toLowerCase(),
    password: z
      .string("Password is required")
      .min(8, "Password must be at least 8 characters long")
      .max(50, "Password maximum 50 characters")
      .trim()
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      ),
    confirmPassword: z
      .string("Password confirmation is required")
      .min(1, "Password confirmation is required")
      .trim(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const userLoginSchema = z.object({
  usernameOrEmail: z
    .string()
    .min(1, "Email or Username is required")
    .trim()
    .refine(
      (val) => emailRegex.test(val) || /^[a-z][a-z0-9._]{2,29}$/.test(val),
      "Must be a valid email or username",
    )
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(50, "Password too long"),
});

const verify2FASchema = z.object({
  otp: z.string({ message: "OTP is required" }).length(6, "Invalid OTP"),
});

const tokenSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\-_]+$/, "Invalid token format")
    .min(32, "Token is too short")
    .max(128, "Token is too long"),
});

const verifyAuthSchema = tokenSchema.extend({
  otp: z.string("OTP is required").min(6, "Invaild OTP").max(6, "Invaild OTP"),
});

const resetToken = z.object({
  emailOrUsername: z
    .string()
    .min(1, "Email or Username is required")
    .trim()
    .refine(
      (val) => emailRegex.test(val) || /^[a-z][a-z0-9._]{2,29}$/.test(val),
      "Must be a valid email or username",
    ),
});

const resetPasswordOtp = tokenSchema.extend({
  otp: z.string({ message: "OTP is required" }).length(6, "Invalid OTP"),
});

const resetPassword = tokenSchema
  .extend({
    password: z
      .string("Password is required")
      .min(8, "Password must be at least 8 characters long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      ),
    confirmPassword: z
      .string("Password confirmation is required")
      .min(1, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const disable2FASchema = z.object({
  password: z
    .string("Password is required")
    .min(8, "Password must be at least 8 characters long")
    .max(50, "Password maximum 50 characters")
    .trim(),
});

const accountDeletion = z.object({
  password: z
    .string("Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(50, "Password must not exceed 50 characters"),

  reason: z
    .string("Reason is required")
    .min(10, "Reason must be at least 10 characters")
    .max(100, "Reason must not exceed 100 characters"),
});

const registerViaTNSchema = z.object({
  full_name: z.string('Full name is required').min(3, "Minimum 3 charcters").max(100, "Maximum 100 charcters"),
  email: z.email("Email is required").trim().toLowerCase(),
  password: z.string('Password is required').min(3, "minium 3 charcters is required").max(200, "Invaild Password"),
  country_code: z.string('country code is required').min(1, "Invaild country code").max(10, "Invaild country code"),
  mobile_no: z.string('Phone number is required').min(10, "Invaild mobile number").max(20, "Invaild mobile number"),
  apiKey: z.string().min(10, "key is required").max(200, "Invaild key")
});

const loginViaTNSchema = z.object({
  email: z.email("Email is required").trim().toLowerCase(),
  apiKey: z.string().min(10, "key is required").max(200, "Invaild key")
});

export const registerValidation = validationInput(registerSchema);
export const authVerify = validationInput(verifyAuthSchema);

export const loginValidate = validationInput(userLoginSchema);
export const verify2FAValidate = validationInput(verify2FASchema);
export const tokenValidate = validationInput(tokenSchema, "params");

export const refreshTokenValidate = validationInput(tokenSchema);

export const resetPasswordValidate1 = validationInput(resetToken);
export const resetPasswordValidate2 = validationInput(resetPasswordOtp);
export const resetPasswordValidate3 = validationInput(resetPassword);
export const disable2FAValidation = validationInput(disable2FASchema);
export const accountValidation = validationInput(accountDeletion);
export const registerViaTNValidation = validationInput(registerViaTNSchema);
export const loginViaTNValidation = validationInput(loginViaTNSchema);
