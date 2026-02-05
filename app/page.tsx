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
  fileData?: string;
  fileName?: string;
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

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
  });

  const isAuthenticated = status === "authenticated";

  const toolbar = useMemo(
    () => (
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "Bold",
            action: () => editor?.chain().focus().toggleBold().run(),
            active: editor?.isActive("bold"),
          },
          {
            label: "Italic",
            action: () => editor?.chain().focus().toggleItalic().run(),
            active: editor?.isActive("italic"),
          },
          {
            label: "Bullet",
            action: () => editor?.chain().focus().toggleBulletList().run(),
            active: editor?.isActive("bulletList"),
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
    [editor],
  );

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
      const fileData = await fileToBase64(scanFile);
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scanTitle,
          source: "scan",
          ocrText,
          fileData,
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

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              <div className="surface rounded-3xl p-6">
                <h2 className="text-lg font-semibold">
                  Upload scanned case note
                </h2>
                <p className="text-sm text-emerald-800">
                  Upload an image or PDF. OCR runs automatically using
                  Tesseract.js.
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
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleScanFile(file);
                    }}
                    disabled={!isAuthenticated}
                    className="w-full text-sm"
                    aria-label="Upload case note image or PDF"
                  />
                  {scanPreview && (
                    <div className="rounded-2xl border border-emerald-300 bg-white p-3">
                      <p className="text-xs text-emerald-800">Preview</p>
                      {scanFile?.type === "application/pdf" ? (
                        <p className="text-sm text-emerald-800">
                          PDF selected: {scanFile?.name}
                        </p>
                      ) : (
                        <img
                          src={scanPreview}
                          alt="Scan preview"
                          className="mt-2 max-h-64 w-full rounded-xl object-contain"
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
                    {savingScan ? "Saving..." : "Save scanned note"}
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
                  <EditorContent editor={editor} className="tiptap" />
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

              <div className="mt-6 space-y-4">
                {notes.map((note) => (
                  <article
                    key={note._id}
                    className="rounded-2xl border border-emerald-300 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold">
                          {note.title}
                        </h3>
                        <p className="text-xs text-emerald-800">
                          {note.source === "manual" ? "Manual" : "Scanned"} •{" "}
                          {formatDate(note.createdAt)}
                        </p>
                      </div>
                      <span className="pill rounded-full px-3 py-1 text-xs font-semibold">
                        {note.source === "manual" ? "Typed" : "OCR"}
                      </span>
                    </div>
                    {note.source === "manual" ? (
                      <div
                        className="mt-3 text-sm leading-6"
                        dangerouslySetInnerHTML={{
                          __html: note.contentHtml ?? "",
                        }}
                      />
                    ) : (
                      <div className="mt-3 space-y-3 text-sm">
                        {note.fileData && (
                          <a
                            href={note.fileData}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-800 underline"
                          >
                            View uploaded file ({note.fileName})
                          </a>
                        )}
                        <pre className="whitespace-pre-wrap rounded-xl border border-emerald-300 bg-white p-3 text-xs text-emerald-900">
                          {note.ocrText || "No OCR text captured."}
                        </pre>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </main>

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
