import { z } from "zod";

export const signupSchema = z.object({
  name: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(1, "Full name is required")
    .max(100),
  email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const signinSchema = z.object({
  email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;