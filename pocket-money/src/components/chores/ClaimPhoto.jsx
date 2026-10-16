import { useRef, useState } from "react";
import { Camera, Check, X, ImageIcon } from "lucide-react";
import { useAttachClaimPhoto, useClaimPhotoUrl } from "../../hooks/useClaims";

// Child side: "Add a photo" for a pending claim. Opens the camera on phones.
export function AddClaimPhoto({ claim, familyId, color, little = false, onDone }) {
  const inputRef = useRef(null);
  const attach = useAttachClaimPhoto();
  const [err, setErr] = useState("");

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try {
      await attach.mutateAsync({ claimId: claim.id, familyId, file });
      onDone?.();
    } catch (ex) {
      setErr(ex.message || "Couldn't send that photo — try again.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={attach.isPending}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold text-white transition active:scale-[0.97] disabled:opacity-60 ${little ? "h-11 px-4 text-[14px]" : "h-9 px-3 text-[12.5px]"}`}
        style={{ background: color }}
      >
        <Camera size={little ? 17 : 14} /> {attach.isPending ? "Sending…" : little ? "Take a photo" : "Add photo"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      {err && <span className="text-[12px] text-rose-600 ml-2">{err}</span>}
    </>
  );
}

// Parent side: a thumbnail that opens the full photo.
export function ClaimPhotoThumb({ path, size = 44 }) {
  const { data: url } = useClaimPhotoUrl(path);
  const [open, setOpen] = useState(false);
  if (!path) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="See photo"
        className="rounded-xl overflow-hidden border border-line bg-surface shrink-0 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={18} className="text-ink-muted" />}
      </button>
      {open && url && <PhotoViewer url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PhotoViewer({ url, caption, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] bg-ink/90 flex flex-col items-center justify-center p-4" onClick={onClose} role="dialog" aria-label="Photo">
      <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/15 text-white flex items-center justify-center">
        <X size={20} />
      </button>
      <img src={url} alt="" className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
      {caption && <p className="mt-3 text-white/85 text-[14px] font-medium inline-flex items-center gap-1.5"><Check size={15} /> {caption}</p>}
    </div>
  );
}
