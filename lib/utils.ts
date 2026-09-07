import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
  }).format(amount);
}

/**
 * Extracts a user-friendly error message in Arabic from any error object or exception
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallback = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى."
): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    // Map common browser/network errors to friendly Arabic
    const msg = error.message;
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
      return "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.";
    }
    if (msg.includes("aborted") || msg.includes("timeout")) {
      return "استغرقت العملية وقتاً أطول من المتوقع، يرجى المحاولة مجدداً.";
    }
    return msg;
  }
  return fallback;
}

/**
 * Safely reads a File into a base64 Data URL with full error rejection and timeout protection
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("لم يتم تحديد أي ملف للقراءة."));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error(`تعذر تحويل الملف ${file.name} إلى صورة.`));
      }
    };

    reader.onerror = () => {
      reject(new Error(`فشلت قراءة الملف ${file.name}. قد يكون الملف تالفاً أو غير مدعوم.`));
    };

    reader.onabort = () => {
      reject(new Error(`تم إلغاء قراءة الملف ${file.name}.`));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Opens a URL in a new window/tab safely, returning false if blocked by popup blocker
 */
export function safeOpenUrl(url: string, target = "_blank"): boolean {
  if (typeof window === "undefined") return false;
  try {
    const win = window.open(url, target);
    if (!win || win.closed || typeof win.closed === "undefined") {
      // Popup blocked, fallback to direct location
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Compresses an image file to a lightweight WebP Data URL (client-side, 100% free, ~25KB)
 */
export function compressImageToWebP(
  file: File,
  maxDimension = 800,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      if (w > maxDimension || h > maxDimension) {
        if (w > h) {
          h = Math.round((h * maxDimension) / w);
          w = maxDimension;
        } else {
          w = Math.round((w * maxDimension) / h);
          h = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(img.src);
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/webp", quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

