import { useAvatarUrl } from "../../hooks/useChildren";
import { themeColor, ThemeBadge, THEME_ICONS } from "../../lib/theme";
import { Avatar } from "../ui";

// A child's avatar, best available first: their photo (with the chosen icon
// pinned to the corner), else their chosen icon, else their initial — all in
// their chosen (or name-derived) colour.
export function ChildAvatar({ kid, size = 48, className = "" }) {
  const { data: url } = useAvatarUrl(kid.avatar_url);
  const color = themeColor(kid.theme, kid.name);
  const Icon = kid.theme?.icon && THEME_ICONS[kid.theme.icon];

  if (kid.avatar_url) {
    const photo = <Avatar name={kid.name} size={size} className={className} src={url} colors={[color.main, color.soft]} />;
    if (!Icon) return photo;
    return (
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {photo}
        <ThemeBadge theme={kid.theme} name={kid.name} size={Math.max(18, Math.round(size * 0.42))} className="absolute -bottom-0.5 -right-0.5" />
      </span>
    );
  }

  if (Icon) {
    return (
      <span
        className={`rounded-full flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size, background: color.soft, color: color.main }}
        aria-hidden
      >
        <Icon size={Math.round(size * 0.52)} strokeWidth={2.1} />
      </span>
    );
  }

  return <Avatar name={kid.name} size={size} className={className} colors={[color.main, color.soft]} />;
}
