"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Smile, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AvatarCropModal } from "@/components/ui/avatar-crop";
import { Button } from "@/components/ui/button";
import { saveAvatar } from "./actions";

const EMOJIS = "😀 😎 🤓 🧑‍💻 👩‍💼 👨‍💼 🦸 🦊 🐱 🐶 🐼 🦁 🐯 🦉 🐲 🚀 ⭐ 🔥 💡 🎯 🌟 🏆 ⚡ 🎨 📊 💼 🧠 🌈 ❤️ 🍀".split(" ");

export function AvatarEditor({
  avatar,
  emoji,
  initials,
}: {
  avatar: string | null;
  emoji: string | null;
  initials: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  // crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Нужна картинка"); return; }
    if (f.size > 25 * 1024 * 1024) { setError("Фото не больше 25 МБ"); return; }
    setError(null);
    // create object URL and open crop modal
    const url = URL.createObjectURL(f);
    setCropSrc(url);
  }

  async function uploadBlob(blob: Blob) {
    setCropSrc(null);
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) { setError("Не удалось загрузить"); return; }
      const data = await res.json();
      start(() => saveAvatar(data.url, null));
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {cropSrc && (
        <AvatarCropModal
          src={cropSrc}
          onClose={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
          onConfirm={(blob) => { URL.revokeObjectURL(cropSrc); uploadBlob(blob); }}
        />
      )}

      <div className="flex flex-wrap items-center gap-5">
        <Avatar image={avatar} emoji={emoji} initials={initials} size={84} ring />

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Загрузить фото
            </Button>

            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEmojiOpen((v) => !v)}
              >
                <Smile className="h-4 w-4" />
                Эмодзи
              </Button>
              {emojiOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
                  <div className="glass-strong absolute left-0 top-11 z-20 grid w-64 grid-cols-6 gap-1 rounded-xl p-2 shadow-2xl">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setEmojiOpen(false);
                          start(() => saveAvatar(null, e));
                        }}
                        className="flex items-center justify-center rounded-lg p-1 text-xl leading-none hover:bg-white/10"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {(avatar || emoji) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => start(() => saveAvatar(null, null))}
              >
                <Trash2 className="h-4 w-4" />
                Убрать
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <p className="text-xs text-neutral-500">
            Фото (до 25 МБ) или эмодзи вместо аватара.
          </p>
        </div>
      </div>
    </>
  );
}
