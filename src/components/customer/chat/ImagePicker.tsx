"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { chromeLink, galleryAccept, isAndroid, isImageFile, isInAppBrowser, prepareImageWithStatus } from "@/lib/browser";
import { forgetPicking, rememberPicking } from "@/lib/pickingMemory";
import { recordUploadProblem } from "@/lib/supabase/uploadProblems";

const WAIT_FOR_FILE_MS = 1500;
const TRIES_BEFORE_FILES = 2;

type ImagePickerProps = {
  image: string | null;
  onChange: (image: string | null) => void;
  label?: string;
  failedUploads?: number;
  customerId?: string;
  pageReloaded?: boolean;
};

export default function ImagePicker({ image, onChange, label = "Choose screenshot", failedUploads = 0, customerId, pageReloaded = false }: ImagePickerProps) {
  const galleryInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const stopWaiting = useRef<(() => void) | null>(null);
  const [error, setError] = useState(pageReloaded ? "The page reloaded while your picture was opening. Please choose it again." : "");
  const [loading, setLoading] = useState(false);
  // old browser  not make  picture smaller
  const [outdated, setOutdated] = useState(false);
  const [failures, setFailures] = useState(pageReloaded ? 1 : 0);
  const [filesFailed, setFilesFailed] = useState(false);
  const [inAppBrowser] = useState(isInAppBrowser);

  useEffect(() => () => stopWaiting.current?.(), []);

  const countFailure = (reason: string, fromFiles: boolean) => {
    setFailures((count) => count + 1);
    if (fromFiles) setFilesFailed(true);
    recordUploadProblem(reason);
  };

  const waitForFile = (fromFiles: boolean) => {
    stopWaiting.current?.();
    let timer: number | undefined;

    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        stopWaiting.current?.();
        countFailure("no file came back from the picker", fromFiles);
      }, WAIT_FOR_FILE_MS);
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    stopWaiting.current = () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.clearTimeout(timer);
      stopWaiting.current = null;
      forgetPicking();
    };
    if (customerId) rememberPicking(customerId);
  };

  const openPicker = (fromFiles: boolean) => {
    const input = fromFiles ? filesInput.current : galleryInput.current;
    if (!input) return;
    if (!fromFiles) input.accept = galleryAccept();
    setError("");
    waitForFile(fromFiles);
    input.click();
  };

  const pickFile = async (input: HTMLInputElement, fromFiles: boolean) => {
    const file = input.files?.[0];
    if (!file) return;
    stopWaiting.current?.();
    if (!isImageFile(file)) {
      input.value = "";
      setError("Please choose an image file.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const prepared = await prepareImageWithStatus(file);
      setOutdated(prepared.original);
      setFailures(0);
      onChange(prepared.image);
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "This picture couldn't be opened. Please choose it again.";
      const name = problem instanceof Error ? problem.name : "Error";
      setError(message);
      countFailure(`${name}: ${message} (${file.type || "no type"}, ${file.size} bytes)`, fromFiles);
    }
    // Cleared only now: some phones stop giving access to the picture once the input is emptied.
    input.value = "";
    setLoading(false);
  };

  const tries = failures + failedUploads;
  const useFiles = !image && tries >= TRIES_BEFORE_FILES;

  return (
    <div>
      {inAppBrowser && !image && (
        <div className="mb-3 rounded-xl bg-amber-50 text-amber-900 px-3 py-2.5 text-[12.5px]">
          <p>Pictures may not work in this app&apos;s browser. Please open this page in {isAndroid() ? "Chrome" : "Safari"} and sign in there.</p>
          {isAndroid() && (
            <a href={chromeLink()} className="mt-1 inline-block font-semibold underline">
              Open in Chrome
            </a>
          )}
        </div>
      )}
      <input ref={galleryInput} type="file" accept="image/*" hidden onChange={(event) => pickFile(event.target, false)} />
      <input ref={filesInput} type="file" hidden onChange={(event) => pickFile(event.target, true)} />
      <button
        type="button"
        disabled={loading}
        onClick={() => openPicker(useFiles)}
        className="w-full rounded-2xl border border-dashed border-black/15 bg-[var(--bg)]/50 hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] transition overflow-hidden"
      >
        {image ? (
          <img src={image} alt="Selected screenshot" className="w-full max-h-64 object-contain bg-black/5" />
        ) : (
          <div className="py-8 flex flex-col items-center gap-2 text-[var(--muted)]">
            <div className="size-11 rounded-full bg-black/[0.04] grid place-items-center text-[var(--text)]">
              <ImageIcon size={19} />
            </div>
            <div className="text-[14px] font-semibold text-[var(--text)]">{loading ? "Loading…" : useFiles ? "Choose from Files" : label}</div>
            <div className="text-[12px]">PNG or JPG from your {useFiles ? "files" : "gallery"}</div>
          </div>
        )}
      </button>
      {image && (
        <button type="button" onClick={() => onChange(null)} className="mt-2 text-[12.5px] text-[var(--muted)] hover:text-[var(--text)]">
          Remove screenshot
        </button>
      )}
      {error &&<p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
      {!image && !error && tries > 0 && (
        <p className="mt-2 text-[12.5px] text-red-600">
          {filesFailed ? "Picture still wasn't added. Please update Chrome, then try again." : useFiles ? "Now you can try Choose from Files." : "Picture wasn't added. Please try again."}
        </p>
      )}
      {image && outdated && <p className="mt-2 text-[12.5px] text-amber-700">Your browser is out of date. Please update it for a smoother experience.</p>}
    </div>
  );
}
