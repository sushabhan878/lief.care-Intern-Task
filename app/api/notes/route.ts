import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

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
  const {
    title,
    source,
    contentHtml,
    ocrText,
    fileUrl,
    fileName,
    fileType,
    filePublicId,
  } = body;

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
    fileUrl: fileUrl ?? "",
    fileName: fileName ?? "",
    fileType: fileType ?? "",
    filePublicId: filePublicId ?? "",
    createdAt: new Date(),
  });

  return NextResponse.json({ id: result.insertedId.toString() });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, title, contentHtml, ocrText } = body;

  if (!id || !title) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 },
    );
  }

  const client = await clientPromise;
  const db = client.db("lief_mvp");

  // Verify the note belongs to the current user
  const existingNote = await db.collection("notes").findOne({
    _id: new ObjectId(id),
    doctorId: session.user.email,
  });

  if (!existingNote) {
    return NextResponse.json(
      { error: "Note not found or unauthorized" },
      { status: 404 },
    );
  }

  // Update the note
  const updateData: any = {
    title,
    updatedAt: new Date(),
  };

  if (existingNote.source === "manual") {
    updateData.contentHtml = contentHtml ?? "";
  } else {
    updateData.ocrText = ocrText ?? "";
  }

  await db
    .collection("notes")
    .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing note ID" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db("lief_mvp");

  // Verify the note belongs to the current user
  const existingNote = await db.collection("notes").findOne({
    _id: new ObjectId(id),
    doctorId: session.user.email,
  });

  if (!existingNote) {
    return NextResponse.json(
      { error: "Note not found or unauthorized" },
      { status: 404 },
    );
  }

  // Delete the note
  await db.collection("notes").deleteOne({
    _id: new ObjectId(id),
  });

  return NextResponse.json({ success: true });
}
