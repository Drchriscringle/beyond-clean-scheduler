import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { notifyChild, notifyParents } from "./usePush";

export function useMessages(childId, enabled = true) {
  return useQuery({
    queryKey: ["messages", childId],
    queryFn: () => api.listMessages(childId),
    enabled: !!childId && enabled,
  });
}

// Unread counts per child. `me` is 'parent' or 'child' — we count what the
// *other* side has sent that hasn't been read yet.
export function useUnreadMessages(me, enabled = true) {
  const other = me === "parent" ? "child" : "parent";
  return useQuery({
    queryKey: ["unreadMessages", other],
    queryFn: () => api.listUnreadMessages(other),
    enabled,
    retry: false,
  });
}

function invalidateAll(queryClient) {
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "messages" || q.queryKey[0] === "unreadMessages" });
}

// Sends and (best effort) pushes a notification to the other side.
export function useSendMessage({ me, kid }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, kind }) => api.sendMessage({ familyId: kid.family_id, childId: kid.id, sender: me, body, kind }),
    onSuccess: (msg) => {
      queryClient.setQueryData(["messages", kid.id], (list) => (list ? [...list.filter((m) => m.id !== msg.id), msg] : [msg]));
      invalidateAll(queryClient);
      const preview = msg.body.length > 80 ? `${msg.body.slice(0, 77)}…` : msg.body;
      if (me === "parent") notifyChild(kid.id, { title: "Message from home", body: preview, tag: `msg-${kid.id}` });
      else notifyParents({ title: `${kid.name} sent a message`, body: preview, tag: `msg-${kid.id}` });
    },
  });
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, fromSender }) => api.markThreadRead(childId, fromSender),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useMessagesRealtime(familyId) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!familyId) return;
    return api.subscribeToMessages(familyId, () => invalidateAll(queryClient));
  }, [familyId, queryClient]);
}
