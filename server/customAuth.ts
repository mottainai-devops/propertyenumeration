import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "./_core/trpc";

// Custom authentication router
export const customAuthRouter = router({
  // Login with email and password
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      // Find user by email
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Check if user has a password set
      if (!user.password) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Password not set for this account",
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Update last signed in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Create session cookie (simplified - using user ID)
      // In production, you'd want to use JWT or proper session management
      const sessionCookie = `session_user_id=${user.id}; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Path=/`;

      // Set cookie in response
      if (ctx.res) {
        ctx.res.setHeader("Set-Cookie", sessionCookie);
      }

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

  // Check current session
  me: publicProcedure.query(async ({ ctx }) => {
    // Get user ID from cookie
    const cookies = ctx.req?.headers.cookie || "";
    const sessionMatch = cookies.match(/session_user_id=(\d+)/);
    
    if (!sessionMatch) {
      return { user: null };
    }

    const userId = parseInt(sessionMatch[1]);

    const db = await getDb();
    if (!db) {
      return { user: null };
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { user: null };
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }),

  // Logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    // Clear session cookie
    const clearCookie = `session_user_id=; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}SameSite=Lax; Max-Age=0; Path=/`;

    if (ctx.res) {
      ctx.res.setHeader("Set-Cookie", clearCookie);
    }

    return { success: true };
  }),
});
