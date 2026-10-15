import { MessageCircle, ChevronRight } from "lucide-react";
import { Section } from "../common";
import { Empty, Pill } from "../ui";
import { ChildAvatar } from "../children/ChildAvatar";

// Parent Home: one row per child, with how many of their messages are
// waiting to be read. Tapping opens the chat.
export function MessagesCard({ kids, unread = {}, onOpen }) {
  const total = Object.values(unread).reduce((s, n) => s + n, 0);
  return (
    <Section title="Messages" icon={<MessageCircle size={18} />} badge={total}>
      {kids.map((kid) => {
        const n = unread[kid.id] || 0;
        return (
          <button key={kid.id} onClick={() => onOpen(kid)} className="w-full flex items-center gap-3 py-2.5 border-b border-line last:border-0 text-left">
            <ChildAvatar kid={kid} size={40} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-ink truncate">{kid.name}</div>
              <div className="text-[12.5px] text-ink-muted">
                {n > 0 ? `${n} new ${n === 1 ? "message" : "messages"} waiting` : kid.username ? "Tap to chat" : "Set a username so they can message you"}
              </div>
            </div>
            {n > 0 && <Pill tone="rose">{n}</Pill>}
            <ChevronRight size={18} className="text-ink-muted" />
          </button>
        );
      })}
      {kids.length === 0 && <Empty>Add a child to start chatting.</Empty>}
    </Section>
  );
}
