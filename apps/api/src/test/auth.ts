import jwt from "jsonwebtoken";
import { z } from "zod";

const JwtPayloadSchema = z.object({ userId: z.string() });
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    console.warn("⚠ JWT_SECRET not set — using an insecure dev fallback. Set JWT_SECRET in apps/api/.env");
    return "dev-insecure-secret";
  }
  return s;
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, secret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, secret());
  return JwtPayloadSchema.parse(decoded);
}