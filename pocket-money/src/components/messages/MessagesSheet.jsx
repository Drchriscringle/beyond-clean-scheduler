import { useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import { useMessages, useSendMessage, useMarkThreadRead } from "../../hooks/useMessages";
import { PARENT_QUICK_REPLIES, childQuickReplies } from "../../lib/quickReplies";
import { themeColor } from "../../lib/theme";
import { playTap } from "../../lib/sound";
import { ChildAvatar } from "../children/ChildAvatar";
import { Empty } from "../ui";

// The chat between the parents and one child. `me` is 'parent' or 'child';
// `mode` (little/middle/big) picks the child's quick replies and sizing.
export function MessagesSheet({ kid, me, mode = "middle", onClose }) {
  const color = themeColor(kid.theme, kid.name);
  const other = me === "parent" ? "child" : "parent";
  const { data: messages = [], isLoading } = useMessages(kid.id);
  const send = useSendMessage({ me, kid });
  const markRead = useMarkThreadRead();
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const little = me === "child" && mode === "little";

  // Anything the other side sent is read once this is open.
  const unreadFromOther = messages.filter((m) => m.sender === other && !m.read_at).length;
  useEffect(() => {
    if (unreadFromOther > 0 && !markRead.isPending) markRead.mutate({ childId: kid.id, fromSender: other });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadFromOther, kid.id, other]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = (body, kind = "text") => {
    const value = body.trim();
    if (!value || send.isPending) return;
    playTap();
    send.mutate({ body: value, kind }, { onSuccess: () => setText("") });
  };

  const quick = me === "parent" ? PARENT_QUICK_REPLIES : childQuickReplies(mode);
  const title = me === "parent" ? kid.name : "Messages from home";

  return (
    <div className="fixed inset-0 z-[60] bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md h-[92dvh] sm:h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Messages"
      >
        <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <ChildAvatar kid={kid} size={38} />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink truncate">{title}</div>
            <div className="text-[12px] text-ink-muted">{me === "parent" ? "Only your family can see this" : "Your grown-ups can see this"}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-surface/60">
          {isLoading && <Empty>Loading…</Empty>}
          {!isLoading && messages.length === 0 && (
            <Empty>{me === "parent" ? `Say hello to ${kid.name} — tap a quick reply or type below.` : "No messages yet. Send one to your grown-ups!"}</Empty>
          )}
          {messages.map((m, i) => {
            const mine = m.sender === me;
            const showDay = i === 0 || dayOf(m.created_at) !== dayOf(messages[i - 1].created_at);
            return (
              <div key={m.id}>
                {showDay && <div className="text-center text-[11px] font-semibold text-ink-muted my-2">{dayLabel(m.created_at)}</div>}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${little ? "text-[16px]" : "text-[14.5px]"} leading-relaxed shadow-sm ${mine ? "text-white rounded-br-md" : "bg-white text-ink rounded-bl-md border border-line"}`}
                    style={mine ? { background: me === "parent" ? "#5b2fa8" : color.main } : undefined}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`text-[10.5px] mt-0.5 ${mine ? "text-white/70" : "text-ink-muted"}`}>
                      {timeOf(m.created_at)}{mine && m.read_at ? " · Seen" : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-line bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
            {quick.map((q) => (
              <button
                key={q}
                onClick={() => submit(q, "quick")}
                disabled={send.isPending}
                className={`shrink-0 rounded-full border px-3.5 font-semibold transition active:scale-[0.97] ${little ? "h-11 text-[15px]" : "h-9 text-[13px]"}`}
                style={{ borderColor: `${color.main}55`, color: color.main, background: color.soft }}
              >
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2 px-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder={little ? "Type here…" : "Write a message…"}
              aria-label="Message"
              className={`flex-1 rounded-xl border border-line bg-white px-3.5 text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${little ? "h-12 text-[16px]" : "h-11 text-[15px]"}`}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!text.trim() || send.isPending}
              className={`${little ? "h-12 w-12" : "h-11 w-11"} rounded-xl text-white flex items-center justify-center disabled:opacity-40 transition active:scale-[0.96]`}
              style={{ background: me === "parent" ? "#5b2fa8" : color.main }}
            >
              <Send size={18} />
            </button>
          </form>
          {send.isError && <p className="px-4 pt-2 text-[12.5px] text-rose-600">Couldn't send that — check your connection and try again.</p>}
        </div>
      </div>
    </div>
  );
}

const dayOf = (iso) => new Date(iso).toDateString();
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
