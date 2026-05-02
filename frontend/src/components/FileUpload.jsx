import { useCallback, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function FileUpload({ file, onFile, disabled }) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);
  const [error, setError] = useState("");

  const validate = (f) => {
    if (!ACCEPTED.includes(f.type)) return "Only PDF, JPEG, or PNG files are accepted.";
    if (f.size > MAX_BYTES) return `File exceeds ${formatBytes(MAX_BYTES)} limit.`;
    return "";
  };

  const handle = useCallback((f) => {
    if (!f) return;
    const err = validate(f);
    if (err) { setError(err); return; }
    setError("");
    onFile?.(f);
  }, [onFile]);

  const onDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    if (disabled) return;
    handle(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); !disabled && setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        className={cn(
          "dropzone-dashed group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl px-6 py-10 text-center transition-all",
          isOver && "ring-2 ring-primary/40 ring-offset-2",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
          disabled={disabled}
        />

        {!file ? (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-subhead text-heading">Drop your loan document here</p>
            <p className="mt-2 text-sm text-body">
              or <span className="text-primary">click to browse</span> — PDF, JPEG or PNG up to 10 MB
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wide text-body">
              <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">.pdf</span>
              <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">.jpeg</span>
              <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">.png</span>
            </div>
          </>
        ) : (
          <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-ambient">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-normal text-heading">{file.name}</p>
              <p className="text-xs text-body tnum">{formatBytes(file.size)} · {file.type || "document"}</p>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFile?.(null); }}
                className="rounded-sm p-1 text-body hover:bg-muted hover:text-heading"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

FileUpload.propTypes = {
  file: PropTypes.object,
  onFile: PropTypes.func,
  disabled: PropTypes.bool,
};

export default FileUpload;
