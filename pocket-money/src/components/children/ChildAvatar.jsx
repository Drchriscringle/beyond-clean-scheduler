import { useAvatarUrl } from "../../hooks/useChildren";
import { themeColor, ThemeBadge } from "../../lib/theme";
import { Avatar } from "../ui";

// A child's avatar: their photo if they've set one, otherwise their initial
// in their chosen (or name-derived) colour. `badge` pins their chosen icon
// to the bottom-right corner.
export function ChildAvatar({ kid, size = 48, className = "", badge = false }) {
  const { data: url } = useAvatarUrl(kid.avatar_url);
  const color = themeColor(kid.theme, kid.name);
  const avatar = (
    <Avatar name={kid.name} size={size} className={className} src={kid.avatar_url ? url : undefined} colors={[color.main, color.soft]} />
  );
  if (!badge || !kid.theme?.icon) return avatar;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {avatar}
      <ThemeBadge theme={kid.theme} name={kid.name} size={Math.max(18, Math.round(size * 0.42))} className="absolute -bottom-0.5 -right-0.5" />
    </span>
  );
}
