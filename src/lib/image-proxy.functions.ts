import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  url: z.string().url(),
});

export const fetchImageBase64 = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return `data:${contentType};base64,${base64}`;
    } catch (err) {
      console.warn("Failed to proxy image:", data.url, err);
      return null;
    }
  });
