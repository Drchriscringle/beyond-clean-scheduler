import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { notifyChild, notifyParents } from "./usePush";

const invalidate = (qc) => {
  qc.invalidateQueries({ queryKey: ["childPoints"] });
  qc.invalidateQueries({ queryKey: ["rewardRequests"] });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "pointsHistory" });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "balance" });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "activity" });
};

export function useRewards() {
  return useQuery({ queryKey: ["rewards"], queryFn: api.listRewards });
}

export function useAddReward() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.addReward, onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }) });
}

export function useRemoveReward() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.removeReward, onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }) });
}

export function useUpdateQuizReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, ...patch }) => api.updateQuizReward(childId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useChildPoints() {
  return useQuery({ queryKey: ["childPoints"], queryFn: api.listChildPoints });
}

export function usePointsHistory(childId, enabled = true) {
  return useQuery({ queryKey: ["pointsHistory", childId], queryFn: () => api.listPointsHistory(childId), enabled: !!childId && enabled });
}

// Awards a correct quiz answer / game result. Never throws into the UI.
export function useAwardLearning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.awardLearning,
    onSuccess: () => invalidate(qc),
  });
}

export function useAdjustPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, delta, why }) => api.adjustPoints(childId, delta, why),
    onSuccess: () => invalidate(qc),
  });
}

export function useRewardRequests(status = null) {
  return useQuery({ queryKey: ["rewardRequests", status], queryFn: () => api.listRewardRequests(status) });
}

export function useRequestReward(kid) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId }) => api.requestReward(rewardId),
    onSuccess: (req) => {
      invalidate(qc);
      notifyParents({ title: `${kid.name} would like a reward`, body: `${req.reward_name} · ${req.cost_points} points — tap to answer`, tag: `reward-${req.id}` });
    },
  });
}

export function useDecideReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ request, grant }) => api.decideReward(request.id, grant),
    onSuccess: (_d, { request, grant }) => {
      invalidate(qc);
      notifyChild(request.child_id, {
        title: grant ? "Yes! Reward on its way" : "Not this time",
        body: grant ? `${request.reward_name} — a grown-up said yes!` : `${request.reward_name} — your points are back in your pot.`,
        tag: `reward-${request.id}`,
      });
    },
  });
}

export function useRewardsRealtime(familyId) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!familyId) return;
    return api.subscribeToRewards(familyId, () => invalidate(qc));
  }, [familyId, qc]);
}
