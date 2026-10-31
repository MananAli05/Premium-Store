// Only for browsers that cannot make the picture smaller: the original is sent, up to 2 MB.
const MAX_ORIGINAL_BYTES = 2 * 1024 * 1024;
const MAX_PICKED_BYTES = 20 * 1024 * 1024;
const READ_ATTEMPTS = 3;
const READ_RETRY_MS = 300;
const SENDABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const TYPES_BY_EXTENSION: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

// Some phones and gallery apps leave the type empty, so the file name is used instead.
function imageTypeOf(file: File) {
  if (file.type) return file.type;
  return TYPES_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}

export function isImageFile(file: File) {
  const type = imageTypeOf(file);
  return type ? type.startsWith("image/") : true;
}

// Android Chrome opens the system Photo Picker when only images are accepted, and that picker can
// return without giving the page the file. One non-image type makes Chrome use its normal chooser.
export function galleryAccept() {
  return isAndroid() ? "image/*,application/x-premium-store" : "image/*";
}

export function isInAppBrowser() {
  return /; wv\)|FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|TikTok|musical_ly/i.test(navigator.userAgent);
}

export function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

export function chromeLink() {
  const { host, pathname, search } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
}

async function compressImage(file: File, maxSize: number, quality: number) {
  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = url;
    });
    if (!image.width || !image.height) throw new Error("Empty image");

    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    // A white background, so see-through parts of a PNG do not turn black in the JPEG.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (isOneColour(canvas)) throw new Error("Blank image");

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    // A browser that cannot draw the picture returns an empty image ("data:,").
    if (!dataUrl.startsWith("data:image/") || dataUrl.length < 200) throw new Error("Empty image");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Some phones fail to draw the picture without any error and give a plain black (or white) image.
// A real screenshot always has some detail, so an image of one colour means the drawing failed.
function isOneColour(source: HTMLCanvasElement) {
  try {
    const sample = document.createElement("canvas");
    sample.width = 24;
    sample.height = 24;
    const context = sample.getContext("2d");
    if (!context) return false;
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let darkest = 765;
    let lightest = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const brightness = pixels[index] + pixels[index + 1] + pixels[index + 2];
      darkest = Math.min(darkest, brightness);
      lightest = Math.max(lightest, brightness);
    }
    return lightest - darkest < 24;
  } catch {
    return false;
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readBytes(file: File) {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// A picture from the phone can stop being readable soon after it is picked, so its bytes are copied straight away.
async function copyIntoMemory(file: File) {
  for (let attempt = 1; ; attempt++) {
    try {
      return new File([await readBytes(file)], file.name, { type: file.type });
    } catch (problem) {
      if (attempt === READ_ATTEMPTS) {
        const unreadable = new Error("This picture couldn't be opened. Please choose it again.");
        if (problem instanceof Error) unreadable.name = problem.name;
        throw unreadable;
      }
      await new Promise((resolve) => setTimeout(resolve, READ_RETRY_MS));
    }
  }
}
export async function prepareImageWithStatus(picked: File, maxSize = 1000, quality = 0.72) {
  if (picked.size === 0) throw new Error("This picture is not on your phone yet. Open it in your gallery first, then choose it again.");
  if (picked.size > MAX_PICKED_BYTES) throw new Error("This picture is too large. Please choose a screenshot, not a camera photo.");

  const file = await copyIntoMemory(picked);

  try {
    return { image: await compressImage(file, maxSize, quality), original: false };
  } catch {
    const type = imageTypeOf(file);
    if (!SENDABLE_TYPES.includes(type)) throw new Error("This picture couldn't be opened. Please choose a PNG or JPG screenshot, or update your browser.");
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error("This picture is too large. Please choose a screenshot under 2 MB, or update your browser.");
    const dataUrl = await readAsDataUrl(file).catch(() => {
      throw new Error("This picture couldn't be opened. Please choose it again.");
    });
    return { image: dataUrl.replace(/^data:[^;,]*/, `data:${type}`), original: true };
  }
}

export async function prepareImage(file: File, maxSize?: number, quality?: number) {
  return (await prepareImageWithStatus(file, maxSize, quality)).image;
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function playAlertSound() {
  try {
    const context = new AudioContext();

    const playTone = (frequency: number, delay: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;

      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    };

    playTone(880, 0);
    playTone(1320, 0.14);
  } catch {}
}
