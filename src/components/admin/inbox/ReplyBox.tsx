"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, MessageSquareText } from "lucide-react";
import { isImageFile, prepareImage } from "@/lib/browser";
import { classNames } from "@/lib/format";
import { getState } from "@/lib/store/state";
import { orderWaitingForCode, planMismatch } from "@/lib/planCheck";
import { sendAdminImage, sendAdminMessage } from "@/lib/store/admin";
import { useAppState } from "@/lib/store/state";

const MAX_INPUT_HEIGHT = 200;

type ReplyBoxProps = {
  customerId: string;
};

export default function ReplyBox({ customerId }: ReplyBoxProps) {
  const quickReplies = useAppState().settings.quickReplies.filter((reply) => reply.trim());
  const [text, setText] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = textArea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [text]);

  const sendImage = async (file?: File) => {
    if (!file || !isImageFile(file)) return;
    setUploading(true);
    try {
      setImageError((await sendAdminImage(customerId, await prepareImage(file))) ?? "");
    } catch (problem) {
      setImageError(problem instanceof Error ? problem.message : "This picture couldn't be opened.");
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const send = (message: string) => {
    const content = message.trim();
    if (!content) return;

    const order = orderWaitingForCode(getState().orders, customerId);
    const wrongPlan = order ? planMismatch(content, order.planName) : null;
    if (wrongPlan) {
      window.alert(wrongPlan);
      return;
    }

    sendAdminMessage(customerId, content);
    setText("");
    setShowQuickReplies(false);
  };

  return (
    <div className="bg-white border-t border-zinc-200/80 px-4 lg:px-6 py-3.5">
      <div>
        {showQuickReplies && (
          <div className="mb-2.5 flex flex-wrap gap-1.5 fade-in">
            {quickReplies.map((reply) => (
              <button key={reply} onClick={() => send(reply)} className="text-[12.5px] px-3 py-1.5 rounded-full border border-zinc-200 hover:border-[#0C2660]/40 hover:bg-[#0C2660]/[0.04] text-zinc-700 text-left transition">
                {reply}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-[#f8f9fb] focus-within:border-[#0C2660]/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0C2660]/[0.06] transition">
          <textarea
            ref={textArea}
            value={text}
            maxLength={1000}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(text);
              }
            }}
            rows={1}
            placeholder={uploading ? "Sending image…" : "Type a message or code…"}
            className="block w-full resize-none min-h-11 bg-transparent px-3.5 pt-3 pb-1 text-[14px] leading-5 outline-none placeholder:text-zinc-400 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
          <div className="flex items-center gap-1 px-1.5 pb-1.5">
            <button
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className={classNames("size-9 grid place-items-center rounded-xl transition", showQuickReplies ? "bg-[#0C2660] text-white" : "text-zinc-500 hover:bg-zinc-200/60")}
              aria-label="Quick replies"
              title="Quick replies"
            >
              <MessageSquareText size={17} />
            </button>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => sendImage(event.target.files?.[0])} />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="size-9 grid place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 transition disabled:opacity-40"
              aria-label="Send an image"
              title="Send an image"
            >
              <ImagePlus size={17} />
            </button>
            <button
              onClick={() => send(text)}
              disabled={!text.trim()}
              className="ml-auto h-9 px-5 rounded-xl bg-[#0C2660] text-white text-[13.5px] font-semibold hover:bg-[#0a1f52] transition disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>

        {imageError && <p className="mt-2 text-[12px] text-red-600">{imageError}</p>}

      </div>
    </div>
  );
}
