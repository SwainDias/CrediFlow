import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Lock, Zap } from "lucide-react";
import FileUpload from "@/components/FileUpload";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const submit = () => {
    if (!file) {
      toast.error("Please choose a document first.");
      return;
    }
    // Hand off the file via navigation state to the processing page.
    navigate("/processing", { state: { file } });
  };

  return (
    <section className="container max-w-5xl py-14 md:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-sm border border-border-soft-purple bg-accent px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-primary">
          Step 1 of 3 · Upload
        </span>
        <h1 className="text-display-large mt-5 text-heading">Submit a loan application.</h1>
        <p className="mt-4 text-body-lg text-body">
          Upload the applicant's signed loan form. Our agents will extract the data, run KYC, and
          score risk in under two minutes.
        </p>
      </div>

      <div className="mt-12">
        <FileUpload file={file} onFile={setFile} />
      </div>

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-body">
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> Encrypted in transit</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> SOC 2 aligned pipeline</span>
          <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> ~90s typical processing</span>
        </div>
        <button
          onClick={submit}
          disabled={!file}
          className="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2.5 text-[15px] text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Process application →
        </button>
      </div>
    </section>
  );
}
