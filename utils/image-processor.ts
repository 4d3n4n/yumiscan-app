export async function convertHeicToJpeg(blob: Blob): Promise<Blob> {
    if (blob.type === "image/heic" || blob.type === "image/heif") {
        try {
            const heic2any = (await import("heic2any")).default;
            const convertedBlob = await heic2any({ blob, toType: "image/jpeg", quality: 0.9 });
            return Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        } catch (e) {
            console.error("HEIC conversion failed", e);
            throw e;
        }
    }
    return blob;
}

/**
 * Compresse fortement une image pour le stockage en base et l'affichage dashboard.
 * Redimensionne à 800px maximum (pour préserver les performances Supabase)
 * et exporte en WebP qualité moyenne (0.6).
 */
export async function compressImageForStorage(blob: Blob, maxDimension = 800): Promise<Blob> {
    try { blob = await convertHeicToJpeg(blob); } catch { /* ignore */ }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) { URL.revokeObjectURL(url); resolve(blob); return; }

            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Export to highly compressed WebP exclusively for dashboard visual preview
            canvas.toBlob((webpBlob) => {
                URL.revokeObjectURL(url);
                resolve(webpBlob || blob); // fallback to original if conversion fails
            }, "image/webp", 0.6);
        };

        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image for storage compression")); };
        img.src = url;
    });
}

export async function processImageForOCR(blob: Blob): Promise<Blob> {
    try { blob = await convertHeicToJpeg(blob); } catch { /* continue */ }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) { URL.revokeObjectURL(url); resolve(blob); return; }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    const contrast = 1.2;
                    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
                    const newGray = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
                    data[i] = newGray;
                    data[i + 1] = newGray;
                    data[i + 2] = newGray;
                }

                applySharpening(imageData, canvas.width, canvas.height);
                ctx.putImageData(imageData, 0, 0);

                canvas.toBlob((processedBlob) => {
                    URL.revokeObjectURL(url);
                    resolve(processedBlob || blob);
                }, "image/jpeg", 0.9);
            } catch {
                URL.revokeObjectURL(url);
                resolve(blob);
            }
        };

        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
        img.src = url;
    });
}

function applySharpening(imageData: ImageData, width: number, height: number): void {
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);
    const sharpenAmount = 0.3;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                const top = copy[((y - 1) * width + x) * 4 + c];
                const bottom = copy[((y + 1) * width + x) * 4 + c];
                const left = copy[(y * width + (x - 1)) * 4 + c];
                const right = copy[(y * width + (x + 1)) * 4 + c];
                const center = copy[idx + c];
                const edges = 4 * center - top - bottom - left - right;
                data[idx + c] = Math.min(255, Math.max(0, center + sharpenAmount * edges));
            }
        }
    }
}

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64 ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
