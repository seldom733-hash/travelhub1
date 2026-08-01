"use client";

import { useState } from "react";
import { parseImages } from "@/lib/service-utils";

export default function ServiceGallery({ images, title }: { images: string; title: string }) {
  const [active, setActive] = useState(0);
  const imgs = parseImages(images);

  if (!imgs.length) {
    return (
      <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
        <img src="/placeholder.svg" alt={title} className="w-full h-80 md:h-[420px] object-cover" />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
        <img src={imgs[active]} alt={title} className="w-full h-80 md:h-[420px] object-cover" />
      </div>
      {imgs.length > 1 && (
        <div className="flex gap-3 mt-3 overflow-x-auto no-scrollbar">
          {imgs.slice(0, 5).map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`w-24 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                i === active ? "border-primary shadow-md" : "border-gray-100 opacity-70 hover:opacity-100"
              }`}
            >
              <img src={img} alt={`${title} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
