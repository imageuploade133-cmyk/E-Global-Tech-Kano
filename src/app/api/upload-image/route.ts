import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateUserRequest } from "@/lib/auth-util";
import { extractImgBbDirectUrls, validateImageUrl, ImageMetadata } from "@/lib/image-upload";

// Maximum allowable upload file size: 8 MB
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

// Allowed image MIME types
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Allowed upload purposes
const ALLOWED_PURPOSES = new Set([
  "profile_avatar",
  "kyc_selfie",
  "store_product",
  "estate_property",
  "admin_asset",
  "general",
]);

/**
 * Validates file magic bytes (header bytes) to ensure file content actually matches an allowed image format.
 */
function validateImageMagicBytes(buffer: Buffer): { valid: boolean; detectedMime?: string; error?: string } {
  if (!buffer || buffer.length < 4) {
    return { valid: false, error: "File data is too small or invalid" };
  }

  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { valid: true, detectedMime: "image/png" };
  }

  // GIF: 47 49 46 38 ('GIF8')
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { valid: true, detectedMime: "image/gif" };
  }

  // WEBP: RIFF ... WEBP (52 49 46 46 ... 57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: "image/webp" };
  }

  return { valid: false, error: "File headers do not match any supported image format (JPEG, PNG, WEBP, GIF)" };
}

export async function POST(req: Request) {
  try {
    // STEP 1: Require Authentication via Session or Firebase ID Token
    let authUser: { uid: string; email?: string } | null = null;
    try {
      authUser = await authenticateUserRequest(req);
    } catch (authErr: any) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required to upload images." },
        { status: 401 }
      );
    }

    if (!authUser || !authUser.uid) {
      return NextResponse.json(
        { error: "Unauthorized: Valid user identity required." },
        { status: 401 }
      );
    }

    let file: File | null = null;
    let base64Data: string | null = null;
    let purpose = "general";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      file = formData.get("file") as File | null;
      if (!file) {
        const imgField = formData.get("image");
        if (imgField instanceof File) {
          file = imgField;
        } else if (typeof imgField === "string") {
          base64Data = imgField;
        }
      }
      purpose = (formData.get("purpose") as string) || purpose;
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      base64Data = body.image || body.base64 || body.file;
      purpose = body.purpose || purpose;
    }

    if (!file && !base64Data) {
      return NextResponse.json(
        { error: "No image file or base64 data provided in request" },
        { status: 400 }
      );
    }

    // STEP 2: Purpose Validation
    if (!ALLOWED_PURPOSES.has(purpose)) {
      return NextResponse.json(
        { error: `Invalid upload purpose '${purpose}'. Allowed purposes: ${Array.from(ALLOWED_PURPOSES).join(", ")}` },
        { status: 400 }
      );
    }

    // Convert input to Buffer for strict validation
    let imageBuffer: Buffer;
    let declaredMimeType = "image/png";
    let fileName = "uploaded_image";

    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `File size exceeds the 8MB limit (file is ${(file.size / (1024 * 1024)).toFixed(2)}MB)` },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      declaredMimeType = file.type || declaredMimeType;
      fileName = file.name || fileName;
    } else if (base64Data) {
      let rawBase64 = base64Data;
      if (base64Data.startsWith("data:")) {
        const parts = base64Data.split(",");
        const header = parts[0];
        rawBase64 = parts[1] || "";
        const mimeMatch = header.match(/data:(.*?);/);
        if (mimeMatch) declaredMimeType = mimeMatch[1];
      }
      imageBuffer = Buffer.from(rawBase64, "base64");
      if (imageBuffer.length > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `File size exceeds the 8MB limit (image is ${(imageBuffer.length / (1024 * 1024)).toFixed(2)}MB)` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: "Empty or invalid image content" }, { status: 400 });
    }

    if (imageBuffer.length === 0) {
      return NextResponse.json({ error: "Empty image buffer" }, { status: 400 });
    }

    // STEP 3: Strict Magic Byte & Format Validation
    const magicResult = validateImageMagicBytes(imageBuffer);
    if (!magicResult.valid) {
      return NextResponse.json(
        { error: `Invalid image content: ${magicResult.error}` },
        { status: 400 }
      );
    }

    const verifiedMimeType = magicResult.detectedMime || declaredMimeType;
    if (!ALLOWED_MIME_TYPES.has(verifiedMimeType)) {
      return NextResponse.json(
        { error: `Unsupported image MIME type: ${verifiedMimeType}` },
        { status: 400 }
      );
    }

    // Resolve ImgBB API key safely from server environment or config/app
    let apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      try {
        const appConfigSnap = await adminDb.collection("config").doc("app").get();
        if (appConfigSnap.exists) {
          apiKey = appConfigSnap.data()?.imgbbApiKey;
        }
      } catch (err: any) {
        console.warn("[Upload API] Failed to read fallback ImgBB key from Firestore config:", err.message);
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "ImgBB API Key is not configured in server environment or admin configuration" },
        { status: 500 }
      );
    }

    const finalBase64 = imageBuffer.toString("base64");
    const uploadFormData = new FormData();
    uploadFormData.append("image", finalBase64);

    // CRITICAL REQUIREMENT: ImgBB remains the storage provider.
    // Notice NO 'expiration' parameter is appended to guarantee permanent retention
    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: uploadFormData,
    });

    const imgbbJson = await imgbbRes.json();

    if (!imgbbRes.ok || !imgbbJson.success) {
      const errMsg = imgbbJson.error?.message || "ImgBB upload service error";
      console.error("[Upload API] ImgBB upload failed:", errMsg);
      return NextResponse.json({ error: `Upload failed: ${errMsg}` }, { status: 502 });
    }

    // Safely extract direct image file URL (never url_viewer)
    const { url, backupUrl, id, fileName: extractedName, mimeType: extractedMime, size: extractedSize } = extractImgBbDirectUrls(imgbbJson);

    if (!url) {
      return NextResponse.json({ error: "ImgBB upload succeeded but failed to extract direct image URL" }, { status: 502 });
    }

    // Perform verification on the generated direct image URL before confirming success
    const validation = await validateImageUrl(url);
    if (!validation.valid) {
      console.warn(`[Upload API] Uploaded URL validation failed for ${url}:`, validation.error);
      return NextResponse.json({
        error: `Uploaded image URL verification failed: ${validation.error}`,
      }, { status: 422 });
    }

    const metadata: ImageMetadata = {
      imageProvider: "ImgBB",
      imageId: id,
      fileName: extractedName || fileName,
      mimeType: verifiedMimeType || validation.mimeType || extractedMime,
      fileSize: extractedSize || imageBuffer.length,
      uploadedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      status: "VERIFIED_ACTIVE",
      ownerUid: authUser.uid,
    };

    return NextResponse.json({
      success: true,
      url,
      backupUrl: backupUrl || url,
      metadata,
      purpose,
    });
  } catch (err: any) {
    console.error("[Upload API] Exception:", err);
    return NextResponse.json({ error: err.message || "Failed to process image upload" }, { status: 500 });
  }
}
