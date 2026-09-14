// High-performance client-side image optimization and compression utility

export interface CompressionResult {
  file: File;
  previewUrl: string;
  blurDataUrl: string;
  width: number;
  height: number;
}

const MAX_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.82;
const MAX_RAW_SIZE_BYTES = 10 * 1024 * 1024; // 10MB max initial file size

export async function compressImage(file: File): Promise<CompressionResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files (JPG, PNG, WEBP) are supported.");
  }

  if (file.size > MAX_RAW_SIZE_BYTES) {
    throw new Error("Image file is too large (maximum 10MB).");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if dimensions exceed MAX_DIMENSION
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          // Main compressed canvas
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            throw new Error("Unable to initialize image processing context.");
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Micro blur thumbnail for optimistic placeholder
          const blurCanvas = document.createElement("canvas");
          blurCanvas.width = 32;
          blurCanvas.height = Math.round((32 * height) / width) || 32;
          const blurCtx = blurCanvas.getContext("2d");
          if (blurCtx) {
            blurCtx.drawImage(img, 0, 0, blurCanvas.width, blurCanvas.height);
          }
          const blurDataUrl = blurCanvas.toDataURL("image/jpeg", 0.4);

          // Convert to WebP or JPEG
          const outputType = canvas.toDataURL("image/webp").startsWith("data:image/webp")
            ? "image/webp"
            : "image/jpeg";

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image."));
                return;
              }

              const compressedFile = new File(
                [blob],
                `5min-${Date.now()}.${outputType === "image/webp" ? "webp" : "jpg"}`,
                { type: outputType }
              );

              const previewUrl = URL.createObjectURL(blob);

              resolve({
                file: compressedFile,
                previewUrl,
                blurDataUrl,
                width,
                height,
              });
            },
            outputType,
            COMPRESSION_QUALITY
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error("Failed to load image file."));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Failed to read image file."));
    };

    reader.readAsDataURL(file);
  });
}
