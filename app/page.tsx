"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Note = {
  _id: string;
  title: string;
  source: "manual" | "scan";
  contentHtml?: string;
  ocrText?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  filePublicId?: string;
  createdAt?: string;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
};

export default function Home() {
  const { data: session, status } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [manualTitle, setManualTitle] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const [scanTitle, setScanTitle] = useState("");
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [savingScan, setSavingScan] = useState(false);

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authForm, setAuthForm] = useState({
    name: "",
    position: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
        },
        orderedList: {
          keepMarks: true,
        },
      }),
    ],
    content: "",
    editable: true,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap",
        spellcheck: "false",
      },
    },
  });

  const editEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
        },
        orderedList: {
          keepMarks: true,
        },
      }),
    ],
    content: "",
    editable: true,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap",
        spellcheck: "false",
      },
    },
  });

  const isAuthenticated = status === "authenticated";

  const createToolbar = (editorInstance: typeof editor) =>
    useMemo(
      () => (
        <div className="flex flex-wrap gap-2">
          {[
            {
              label: "Bold",
              action: () => editorInstance?.chain().focus().toggleBold().run(),
              active: editorInstance?.isActive("bold"),
            },
            {
              label: "Italic",
              action: () =>
                editorInstance?.chain().focus().toggleItalic().run(),
              active: editorInstance?.isActive("italic"),
            },
            {
              label: "Strike",
              action: () =>
                editorInstance?.chain().focus().toggleStrike().run(),
              active: editorInstance?.isActive("strike"),
            },
            {
              label: "Code",
              action: () => editorInstance?.chain().focus().toggleCode().run(),
              active: editorInstance?.isActive("code"),
            },
            {
              label: "H1",
              action: () =>
                editorInstance
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: 1 })
                  .run(),
              active: editorInstance?.isActive("heading", { level: 1 }),
            },
            {
              label: "H2",
              action: () =>
                editorInstance
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: 2 })
                  .run(),
              active: editorInstance?.isActive("heading", { level: 2 }),
            },
            {
              label: "H3",
              action: () =>
                editorInstance
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: 3 })
                  .run(),
              active: editorInstance?.isActive("heading", { level: 3 }),
            },
            {
              label: "• Bullet",
              action: () =>
                editorInstance?.chain().focus().toggleBulletList().run(),
              active: editorInstance?.isActive("bulletList"),
            },
            {
              label: "1. Numbered",
              action: () =>
                editorInstance?.chain().focus().toggleOrderedList().run(),
              active: editorInstance?.isActive("orderedList"),
            },
            {
              label: "Quote",
              action: () =>
                editorInstance?.chain().focus().toggleBlockquote().run(),
              active: editorInstance?.isActive("blockquote"),
            },
            {
              label: "Code Block",
              action: () =>
                editorInstance?.chain().focus().toggleCodeBlock().run(),
              active: editorInstance?.isActive("codeBlock"),
            },
            {
              label: "— Line",
              action: () =>
                editorInstance?.chain().focus().setHorizontalRule().run(),
              active: false,
            },
            {
              label: "← Undo",
              action: () => editorInstance?.chain().focus().undo().run(),
              active: false,
            },
            {
              label: "Redo →",
              action: () => editorInstance?.chain().focus().redo().run(),
              active: false,
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className={`rounded-full px-3 py-1 text-sm transition ${
                item.active
                  ? "bg-emerald-700 text-white"
                  : "pill hover:bg-emerald-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ),
      [editorInstance],
    );

  const toolbar = createToolbar(editor);
  const editToolbar = createToolbar(editEditor);

  const loadNotes = async () => {
    if (!isAuthenticated) return;
    setLoadingNotes(true);
    try {
      const response = await fetch("/api/notes");
      const data = await response.json();
      setNotes(data.notes ?? []);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadNotes();
    } else {
      setNotes([]);
    }
  }, [isAuthenticated]);

  const runOcrOnImage = async (image: string | Blob) => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text" && message.progress) {
          setOcrProgress(Math.round(message.progress * 100));
        }
      },
    });

    const result = await worker.recognize(image);
    await worker.terminate();
    return result.data.text;
  };

  const renderPdfToImage = async (file: File) => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    return canvas.toDataURL("image/png");
  };

  const handleScanFile = async (file: File) => {
    setScanFile(file);
    setScanPreview(null);
    setOcrText("");
    setOcrProgress(0);
    setOcrBusy(true);

    try {
      const preview = await fileToBase64(file);
      setScanPreview(preview);

      let ocrSource: string | Blob = file;
      if (file.type === "application/pdf") {
        ocrSource = await renderPdfToImage(file);
      }

      const text = await runOcrOnImage(ocrSource);
      setOcrText(text.trim());
    } catch {
      setOcrText("Unable to extract text. Please try a clearer scan.");
    } finally {
      setOcrBusy(false);
    }
  };

  const saveManualNote = async () => {
    if (!editor || !manualTitle) return;
    setSavingManual(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualTitle,
          source: "manual",
          contentHtml: editor.getHTML(),
        }),
      });
      editor.commands.clearContent();
      setManualTitle("");
      await loadNotes();
    } finally {
      setSavingManual(false);
    }
  };

  const saveScanNote = async () => {
    if (!scanFile || !scanTitle) return;
    setSavingScan(true);
    try {
      // Upload file to Cloudinary
      const uploadFormData = new FormData();
      uploadFormData.append("file", scanFile);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        throw new Error("File upload failed");
      }

      const uploadData = await uploadResponse.json();

      // Save note with Cloudinary URL
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scanTitle,
          source: "scan",
          ocrText,
          fileUrl: uploadData.url,
          filePublicId: uploadData.publicId,
          fileName: scanFile.name,
          fileType: scanFile.type,
        }),
      });
      setScanTitle("");
      setScanFile(null);
      setScanPreview(null);
      setOcrText("");
      setOcrProgress(0);
      await loadNotes();
    } finally {
      setSavingScan(false);
    }
  };

  const handleCredentialsSignIn = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: authForm.email,
        password: authForm.password,
      });

      if (result?.error) {
        setAuthError("Invalid email or password.");
      } else {
        setShowAuthDialog(false);
        setAuthForm({ name: "", position: "", email: "", password: "" });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authForm.name,
          position: authForm.position,
          email: authForm.email,
          password: authForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || "Registration failed.");
        return;
      }

      setAuthMode("signin");
      setAuthError("Account created! Please sign in.");
      setAuthForm({ ...authForm, name: "", position: "" });
    } finally {
      setAuthLoading(false);
    }
  };

  const startEditingNote = (note: Note) => {
    setEditingNote(note);
    setEditTitle(note.title);
    if (note.source === "manual") {
      setEditContent(note.contentHtml ?? "");
      editEditor?.commands.setContent(note.contentHtml ?? "");
    } else {
      setEditContent(note.ocrText ?? "");
    }
  };

  const cancelEditingNote = () => {
    setEditingNote(null);
    setEditTitle("");
    setEditContent("");
    editEditor?.commands.clearContent();
  };

  const saveEditedNote = async () => {
    if (!editingNote || !editTitle) return;
    setSavingEdit(true);
    try {
      const updateData: any = {
        id: editingNote._id,
        title: editTitle,
      };

      if (editingNote.source === "manual") {
        updateData.contentHtml = editEditor?.getHTML() ?? "";
      } else {
        updateData.ocrText = editContent;
      }

      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      cancelEditingNote();
      await loadNotes();
    } finally {
      setSavingEdit(false);
    }
  };

  const startDeletingNote = (note: Note) => {
    setDeletingNote(note);
    setDeleteConfirmation("");
  };

  const cancelDeletingNote = () => {
    setDeletingNote(null);
    setDeleteConfirmation("");
  };

  const confirmDeleteNote = async () => {
    if (deleteConfirmation !== "Delete Note" || !deletingNote) return;
    setDeletingInProgress(true);
    try {
      const response = await fetch("/api/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingNote._id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete note");
      }

      cancelDeletingNote();
      await loadNotes();
    } finally {
      setDeletingInProgress(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1></h1>
      {!isAuthenticated ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
              Lief Notes
            </p>
            <h1 className="text-4xl font-semibold">Doctor Case Notes MVP</h1>
            <p className="mt-2 text-emerald-800">
              Capture, transcribe, and store case notes with OCR.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAuthDialog(true);
              setAuthMode("signin");
              setAuthError("");
            }}
            className="rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-800"
          >
            Get Started
          </button>

          {showAuthDialog && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/20 px-4">
              <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg">
                <h2 className="text-2xl font-semibold">
                  {authMode === "signin" ? "Sign In" : "Create Account"}
                </h2>
                <p className="mt-1 text-sm text-emerald-800">
                  {authMode === "signin"
                    ? "Access your notes and create new ones."
                    : "Join us to start capturing case notes."}
                </p>

                <div className="mt-6 space-y-4">
                  {authMode === "signup" && (
                    <>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={authForm.name}
                        onChange={(e) =>
                          setAuthForm({ ...authForm, name: e.target.value })
                        }
                        className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Position (e.g., Cardiologist)"
                        value={authForm.position}
                        onChange={(e) =>
                          setAuthForm({ ...authForm, position: e.target.value })
                        }
                        className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm"
                      />
                    </>
                  )}
                  <input
                    type="email"
                    placeholder="Email"
                    value={authForm.email}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, email: e.target.value })
                    }
                    className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authForm.password}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, password: e.target.value })
                    }
                    className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm"
                  />
                </div>

                {authError && (
                  <div
                    className={`mt-4 rounded-2xl p-3 text-sm ${
                      authError.includes("created")
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border border-red-300 bg-red-50 text-red-800"
                    }`}
                  >
                    {authError}
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={
                      authMode === "signin"
                        ? handleCredentialsSignIn
                        : handleSignUp
                    }
                    disabled={authLoading}
                    className="rounded-full bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {authLoading
                      ? "Loading..."
                      : authMode === "signin"
                        ? "Sign In"
                        : "Create Account"}
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode(authMode === "signin" ? "signup" : "signin");
                      setAuthError("");
                    }}
                    className="text-sm text-emerald-800 hover:underline"
                  >
                    {authMode === "signin"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </button>
                </div>

                <button
                  onClick={() => setShowAuthDialog(false)}
                  className="mt-4 w-full rounded-full border border-emerald-300 px-4 py-2 text-sm text-emerald-800 transition hover:bg-emerald-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mx-auto w-full max-w-6xl px-6 pt-8 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Lief Notes</h1>
                <p className="mt-1 text-emerald-800">
                  Manage your medical case notes with ease
                </p>
              </div>
              {session?.user && (
                <button
                  onClick={() => signOut()}
                  className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
          <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              <div className="surface rounded-3xl p-6">
                <h2 className="text-lg font-semibold">
                  Upload scanned case note
                </h2>
                <p className="text-sm text-emerald-800">
                  Upload an image or PDF.
                </p>
                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    value={scanTitle}
                    onChange={(event) => setScanTitle(event.target.value)}
                    placeholder="Case title"
                    className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm"
                    disabled={!isAuthenticated}
                  />
                  <div>
                    <input
                      type="file"
                      id="scan-file-input"
                      accept="image/*,application/pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleScanFile(file);
                      }}
                      disabled={!isAuthenticated}
                      className="hidden"
                      aria-label="Upload case note image or PDF"
                    />
                    <label
                      htmlFor="scan-file-input"
                      className={`flex items-center justify-center gap-2 w-full rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-4 py-8 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 hover:border-emerald-500 ${
                        !isAuthenticated
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <span>
                        {scanFile
                          ? `Selected: ${scanFile.name}`
                          : "Click to Upload Image or PDF"}
                      </span>
                    </label>
                  </div>
                  {scanPreview && (
                    <div className="rounded-2xl border border-emerald-300 bg-white p-4">
                      <p className="text-xs font-semibold text-emerald-800 mb-3">
                        Preview
                      </p>
                      {scanFile?.type === "application/pdf" ? (
                        <div className="flex items-center justify-center gap-3 py-8 bg-gray-50 rounded-xl">
                          <svg
                            className="w-8 h-8 text-emerald-700"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {scanFile?.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              PDF document ready for upload
                            </p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={scanPreview}
                          alt="Scan preview"
                          className="w-full max-h-64 rounded-xl object-contain cursor-pointer hover:opacity-90 transition"
                        />
                      )}
                    </div>
                  )}
                  <div className="rounded-2xl border border-emerald-300 bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-emerald-800">
                      <span>OCR transcription</span>
                      {ocrBusy && <span>{ocrProgress}%</span>}
                    </div>
                    <textarea
                      value={ocrText}
                      onChange={(event) => setOcrText(event.target.value)}
                      placeholder="OCR text will appear here"
                      className="mt-2 h-32 w-full resize-none rounded-xl border border-emerald-300 bg-white p-3 text-sm"
                      disabled={!isAuthenticated}
                    />
                  </div>
                  <button
                    onClick={saveScanNote}
                    disabled={
                      !isAuthenticated || savingScan || !scanTitle || !scanFile
                    }
                    className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingScan
                      ? "Uploading and saving..."
                      : "Save scanned note"}
                  </button>
                </div>
              </div>

              <div className="surface rounded-3xl p-6">
                <h2 className="text-lg font-semibold">Manual case note</h2>
                <p className="text-sm text-emerald-800">
                  Type a case note with rich formatting.
                </p>
                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(event) => setManualTitle(event.target.value)}
                    placeholder="Case title"
                    className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm"
                    disabled={!isAuthenticated}
                  />
                  {toolbar}
                  <div className="editor-wrapper">
                    <EditorContent editor={editor} />
                  </div>
                  <button
                    onClick={saveManualNote}
                    disabled={!isAuthenticated || savingManual || !manualTitle}
                    className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingManual ? "Saving..." : "Save manual note"}
                  </button>
                </div>
              </div>
            </section>

            <section className="surface rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Stored notes</h2>
                  <p className="text-sm text-emerald-800">
                    Retrieved from MongoDB for this doctor.
                  </p>
                </div>
                <button
                  onClick={loadNotes}
                  disabled={!isAuthenticated || loadingNotes}
                  className="rounded-full border border-emerald-300 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {loadingNotes ? "Refreshing" : "Refresh"}
                </button>
              </div>

              {!isAuthenticated && (
                <div className="mt-6 rounded-2xl border border-emerald-300 bg-white p-4 text-sm text-emerald-800">
                  Sign in to view and store notes.
                </div>
              )}

              {isAuthenticated && notes.length === 0 && !loadingNotes && (
                <div className="mt-6 rounded-2xl border border-emerald-300 bg-white p-4 text-sm text-emerald-800">
                  No notes yet. Add a manual or scanned case note to get
                  started.
                </div>
              )}

              <div
                className="mt-6 space-y-4 overflow-y-auto"
                style={{ maxHeight: "calc(100vh + 150px)" }}
              >
                {notes.map((note) => (
                  <article
                    key={note._id}
                    className="rounded-2xl border border-emerald-300 bg-white p-6 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {note.title}
                        </h3>
                        <p className="text-xs text-emerald-700 mt-1">
                          {note.source === "manual" ? "Manual" : "Scanned"} •{" "}
                          {formatDate(note.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditingNote(note)}
                          className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => startDeletingNote(note)}
                          className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                        <span className="pill rounded-full px-3 py-1 text-xs font-semibold">
                          {note.source === "manual" ? "Typed" : "OCR"}
                        </span>
                      </div>
                    </div>
                    {note.source === "manual" ? (
                      <div
                        className="note-content mt-4 text-sm leading-7 text-gray-800"
                        dangerouslySetInnerHTML={{
                          __html: note.contentHtml ?? "",
                        }}
                      />
                    ) : (
                      <div className="mt-4 space-y-4 text-sm">
                        {note.fileUrl && (
                          <div className="space-y-2">
                            <a
                              href={note.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-900 hover:underline font-semibold"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M11 3a1 1 0 100 2h3.586L9.293 9.293a1 1 0 000 1.414 1 1 0 001.414 0L16 6.414V10a1 1 0 102 0V4a1 1 0 00-1-1h-6z" />
                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                              </svg>
                              Download file ({note.fileName})
                            </a>
                            {note.fileType?.startsWith("image/") ? (
                              <a
                                href={note.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-xl border border-emerald-200 bg-white overflow-hidden hover:shadow-lg transition"
                              >
                                <img
                                  src={note.fileUrl}
                                  alt={note.fileName}
                                  className="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-95 transition"
                                />
                              </a>
                            ) : note.fileType === "application/pdf" ? (
                              <div className="rounded-xl border border-emerald-200 bg-gray-50 p-4">
                                <div className="flex items-center justify-center gap-3 py-8">
                                  <svg
                                    className="w-8 h-8 text-emerald-700"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                                  </svg>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      PDF Document
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      Click download link above to view
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                        <div className="rounded-xl border border-emerald-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                              OCR Text
                            </div>
                            {note.fileUrl && (
                              <a
                                href={note.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-emerald-700 hover:text-emerald-900 hover:underline font-semibold flex items-center gap-1"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M11 3a1 1 0 100 2h3.586L9.293 9.293a1 1 0 000 1.414 1 1 0 001.414 0L16 6.414V10a1 1 0 102 0V4a1 1 0 00-1-1h-6z" />
                                </svg>
                                Open File
                              </a>
                            )}
                          </div>
                          <pre className="whitespace-pre-wrap font-mono text-xs text-gray-900 leading-6">
                            {note.ocrText || "No OCR text captured."}
                          </pre>
                          {note.fileUrl && (
                            <div className="mt-3 pt-3 border-t border-emerald-200">
                              <p className="text-xs text-gray-600 break-all">
                                <span className="font-semibold text-gray-700">
                                  File URL:
                                </span>{" "}
                                {note.fileUrl}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </main>

          {editingNote && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/20 px-4">
              <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-semibold">
                  Edit {editingNote.source === "manual" ? "Manual" : "Scanned"}{" "}
                  Note
                </h2>
                <p className="mt-1 text-sm text-emerald-800">
                  Update the title and content of your note.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-emerald-900">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Case title"
                      className="mt-2 w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm"
                    />
                  </div>

                  {editingNote.source === "manual" ? (
                    <div>
                      <label className="text-sm font-semibold text-emerald-900">
                        Content
                      </label>
                      <div className="mt-2 space-y-2">
                        {editToolbar}
                        <div className="editor-wrapper">
                          <EditorContent editor={editEditor} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-semibold text-emerald-900">
                        OCR Text
                      </label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="OCR text"
                        className="mt-2 h-48 w-full resize-none rounded-2xl border border-emerald-300 bg-white p-4 text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={saveEditedNote}
                    disabled={savingEdit || !editTitle}
                    className="flex-1 rounded-full bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={cancelEditingNote}
                    disabled={savingEdit}
                    className="rounded-full border border-emerald-300 px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {deletingNote && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/20 px-4">
              <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">
                <h2 className="text-2xl font-semibold text-red-700">
                  Delete Note
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  This action cannot be undone. To confirm deletion, type{" "}
                  <span className="font-semibold text-gray-900">
                    Delete Note
                  </span>{" "}
                  below.
                </p>

                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type 'Delete Note' to confirm"
                  className="mt-4 w-full rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm"
                  autoFocus
                />

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={confirmDeleteNote}
                    disabled={
                      deleteConfirmation !== "Delete Note" || deletingInProgress
                    }
                    className="flex-1 rounded-full bg-red-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                  >
                    {deletingInProgress ? "Deleting..." : "Delete Note"}
                  </button>
                  <button
                    onClick={cancelDeletingNote}
                    disabled={deletingInProgress}
                    className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
                Lief Notes
              </p>
              <h1 className="text-2xl font-semibold">Doctor Case Notes MVP</h1>
              <p className="text-sm text-emerald-800">
                {session?.user?.name} ({session?.user?.email})
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Sign out
            </button>
          </header>
        </>
      )}
    </div>
  );
}
