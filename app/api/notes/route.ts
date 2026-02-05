import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db("lief_mvp");
  const notes = await db
    .collection("notes")
    .find({ doctorId: session.user.email })
    .sort({ createdAt: -1 })
    .toArray();

  const serialized = notes.map((note) => ({
    ...note,
    _id: note._id.toString(),
    createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
  }));

  return NextResponse.json({ notes: serialized });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, source, contentHtml, ocrText, fileData, fileName, fileType } =
    body;

  if (!title || !source) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 },
    );
  }

  const client = await clientPromise;
  const db = client.db("lief_mvp");

  const result = await db.collection("notes").insertOne({
    doctorId: session.user.email,
    title,
    source,
    contentHtml: contentHtml ?? "",
    ocrText: ocrText ?? "",
    fileData: fileData ?? "",
    fileName: fileName ?? "",
    fileType: fileType ?? "",
    createdAt: new Date(),
  });

  return NextResponse.json({ id: result.insertedId.toString() });
}
