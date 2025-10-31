// src/app/api/auth/[...nextauth]/route.ts

import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

// Initialize Prisma Client
const prisma = new PrismaClient();

export const authOptions: AuthOptions = {
  // Use the Prisma adapter to connect Auth.js to your database
  adapter: PrismaAdapter(prisma),

  // Configure one or more authentication providers
  providers: [
    CredentialsProvider({
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" },
      },
      // This function is called when a user tries to sign in
      async authorize(credentials) {
        // Check if email and password were provided
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter an email and password");
        }

        // Find the user in the database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // If no user is found, or if the password doesn't match, return null
        if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
          throw new Error("Invalid credentials");
        }

        // If everything is correct, return the user object (without the password)
        // This user object is then encoded in the JWT
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
      },
    }),
  ],

  // Use JSON Web Tokens for session management
  session: {
    strategy: "jwt",
  },

  // Callbacks are functions that are executed at specific points in the auth flow
  callbacks: {
    // This callback is called whenever a JWT is created or updated
    async jwt({ token, user }) {
      // If a user object is passed, it means they just signed in
      if (user) {
        token.role = user.role; // Add the user's role to the JWT
        token.id = user.id;
      }
      return token;
    },
    // This callback is called whenever a session is checked
    async session({ session, token }) {
      // Add the role and user ID from the token to the session object
      if (session?.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    },
  },

  // Specify a secret for signing the JWT
  secret: process.env.NEXTAUTH_SECRET,
  
  // Define custom pages, like a custom login page
  pages: {
    signIn: "/login", // Redirect users to /login if they need to sign in
  },
};

// Export the handler which connects NextAuth to Next.js's route handlers
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };