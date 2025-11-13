import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  onImageRemove?: () => void;
  selectedImage?: File | null;
  maxSizeMb?: number;
  acceptedFormats?: string[];
  className?: string;
}

const DEFAULT_MAX_SIZE_MB = 10;
const DEFAULT_ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export function ImageUpload({
  onImageSelect,
  onImageRemove,
  selectedImage,
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
  acceptedFormats = DEFAULT_ACCEPTED,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImage]);

  const validateFile = useCallback(
    (file: File) => {
      if (!acceptedFormats.includes(file.type)) {
        setError(`Unsupported file type. Allowed: ${acceptedFormats.join(", ")}`);
        return false;
      }
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxSizeMb) {
        setError(`File is too large. Maximum size is ${maxSizeMb}MB.`);
        return false;
      }
      setError(null);
      return true;
    },
    [acceptedFormats, maxSizeMb]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!validateFile(file)) return;
      onImageSelect(file);
    },
    [onImageSelect, validateFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        handleFiles(event.dataTransfer.files);
        event.dataTransfer.clearData();
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-800",
          selectedImage ? "bg-slate-50 dark:bg-slate-900/40" : "bg-white dark:bg-slate-950"
        )}
      >
        {previewUrl ? (
          <div className="relative w-full max-w-sm">
            <img
              src={previewUrl}
              alt={selectedImage?.name ?? "Uploaded image"}
              className="w-full rounded-lg object-cover shadow-lg"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 text-slate-700 shadow"
              onClick={() => {
                onImageRemove?.();
                setPreviewUrl(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
              <ImageIcon className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Drag & drop an image here
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              PNG, JPG, or WebP up to {maxSizeMb}MB
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Browse Files
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={acceptedFormats.join(",")}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {selectedImage && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{selectedImage.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {(selectedImage.size / (1024 * 1024)).toFixed(2)} MB • {selectedImage.type}
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
