import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import clientPromise from "./mongodb";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";

        if (!email || !password) {
          return null;
        }

        const client = await clientPromise;
        const db = client.db("lief_mvp");
        const doctor = await db
          .collection("doctors")
          .findOne({ email: email.toLowerCase() });

        if (!doctor) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          password,
          doctor.password as string,
        );

        if (passwordMatch) {
          return {
            id: doctor._id?.toString() ?? email,
            email: doctor.email,
            name: doctor.name,
          };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
};
