import { useAvatarUrl } from "../../hooks/useChildren";
import { themeColor } from "../../lib/theme";
import { Avatar } from "../ui";

// A child's avatar: their photo if they've set one, otherwise their initial
// in their chosen (or name-derived) colour.
export function ChildAvatar({ kid, size = 48, className = "" }) {
  const { data: url } = useAvatarUrl(kid.avatar_url);
  const color = themeColor(kid.theme, kid.name);
  return <Avatar name={kid.name} size={size} className={className} src={kid.avatar_url ? url : undefined} colors={[color.main, color.soft]} />;
}
