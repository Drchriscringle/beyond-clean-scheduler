import { useRef, useState } from "react";
import { X, Camera, ImagePlus, Trash2, Check } from "lucide-react";
import { THEME_COLORS, THEME_ICONS, THEME_ICON_KEYS, WALLPAPERS, themeColor, wallpaperStyle } from "../../lib/theme";
import { useUpdateChildTheme, useUploadChildAvatar, useRemoveChildAvatar } from "../../hooks/useChildren";
import { Button, ErrorText } from "../ui";
import { ChildAvatar } from "./ChildAvatar";

function Heading({ children, hint }) {
  return (
    <div className="flex items-baseline justify-between mt-6 mb-2.5">
      <h3 className="text-[13px] font-semibold text-ink">{children}</h3>
      {hint && <span className="text-[11.5px] text-ink-muted">{hint}</span>}
    </div>
  );
}

export function PersonaliseSheet({ kid, familyId, onClose }) {
  const theme = kid.theme || {};
  const color = themeColor(theme, kid.name);
  const updateTheme = useUpdateChildTheme();
  const upload = useUploadChildAvatar();
  const removeAvatar = useRemoveChildAvatar();
  const [err, setErr] = useState("");
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const set = (patch) => updateTheme.mutate({ childId: kid.id, theme: { ...theme, ...patch } });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try {
      await upload.mutateAsync({ childId: kid.id, familyId, file });
    } catch (ex) {
      setErr(ex.message || "Couldn't upload that photo.");
    }
  };

  const saving = updateTheme.isPending || upload.isPending || removeAvatar.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">Make it yours</h2>
            <p className="text-[12.5px] text-ink-muted">{saving ? "Saving…" : "Changes save automatically."}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface">
            <X size={18} />
          </button>
        </div>

        <Heading>Photo</Heading>
        <div className="flex items-center gap-4">
          <ChildAvatar kid={kid} size={72} className="ring-4 ring-line" />
          <div className="flex-1 grid grid-cols-1 gap-2">
            <Button variant="secondary" size="sm" onClick={() => cameraRef.current?.click()} disabled={upload.isPending}>
              <Camera size={15} /> Take a selfie
            </Button>
            <Button variant="secondary" size="sm" onClick={() => galleryRef.current?.click()} disabled={upload.isPending}>
              <ImagePlus size={15} /> Choose a photo
            </Button>
            {kid.avatar_url && (
              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => removeAvatar.mutate(kid.id)} disabled={removeAvatar.isPending}>
                <Trash2 size={15} /> Remove photo
              </Button>
            )}
          </div>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <ErrorText>{err}</ErrorText>

        <Heading>Colour</Heading>
        <div className="flex flex-wrap gap-2.5">
          {THEME_COLORS.map((c) => {
            const selected = c.key === color.key;
            return (
              <button
                key={c.key}
                onClick={() => set({ color: c.key })}
                aria-label={c.name}
                className="h-10 w-10 rounded-full flex items-center justify-center transition active:scale-95"
                style={{ background: c.main, boxShadow: selected ? `0 0 0 3px #fff, 0 0 0 5px ${c.main}` : "none" }}
              >
                {selected && <Check size={18} className="text-white" />}
              </button>
            );
          })}
        </div>

        <Heading hint="Shows next to your name">Icon</Heading>
        <div className="grid grid-cols-6 gap-2">
          <IconTile selected={!theme.icon} onClick={() => set({ icon: null })} color={color}>
            <span className="text-[11px] font-semibold">None</span>
          </IconTile>
          {THEME_ICON_KEYS.map((key) => {
            const Icon = THEME_ICONS[key];
            return (
              <IconTile key={key} selected={theme.icon === key} onClick={() => set({ icon: key })} color={color}>
                <Icon size={20} />
              </IconTile>
            );
          })}
        </div>

        <Heading>Wallpaper</Heading>
        <div className="grid grid-cols-4 gap-2">
          {WALLPAPERS.map((w) => {
            const selected = (theme.wallpaper || "plain") === w.key;
            return (
              <button
                key={w.key}
                onClick={() => set({ wallpaper: w.key })}
                className="rounded-xl overflow-hidden border text-left transition active:scale-[0.97]"
                style={{ borderColor: selected ? color.main : "#e9ebf2", boxShadow: selected ? `0 0 0 2px ${color.main}` : "none" }}
              >
                <div className="h-14" style={wallpaperStyle(w.key, color)} />
                <div className="px-2 py-1.5 text-[11px] font-semibold text-ink bg-white">{w.name}</div>
              </button>
            );
          })}
        </div>

        <Button className="w-full mt-6" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function IconTile({ children, selected, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="h-12 rounded-xl flex items-center justify-center transition active:scale-95"
      style={{
        background: selected ? color.main : color.soft,
        color: selected ? "#fff" : color.main,
        boxShadow: selected ? `0 0 0 2px ${color.main}` : "none",
      }}
    >
      {children}
    </button>
  );
}
