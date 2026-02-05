import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, position, email, password } = body;

  if (!name || !position || !email || !password) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 },
    );
  }

  const client = await clientPromise;
  const db = client.db("lief_mvp");
  const doctorsCollection = db.collection("doctors");

  const existingDoctor = await doctorsCollection.findOne({
    email: email.toLowerCase(),
  });

  if (existingDoctor) {
    return NextResponse.json(
      { error: "Email already registered." },
      { status: 409 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await doctorsCollection.insertOne({
    name,
    position,
    email: email.toLowerCase(),
    password: hashedPassword,
    createdAt: new Date(),
  });

  return NextResponse.json({
    id: result.insertedId.toString(),
    message: "Doctor registered successfully.",
  });
}
