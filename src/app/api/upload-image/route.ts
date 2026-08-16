import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { extractImgBbDirectUrls, validateImageUrl, ImageMetadata } from "@/lib/image-upload";

export async function POST(req: Request) {
  try {
    let file: File | null = null;
    let base64Data: string | null = null;
    let purpose = "general";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      file = formData.get("file") as File | null;
      if (!file) {
        // Fallback check for "image" form field
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
      return NextResponse.json({ error: "No image file or base64 data provided in request" }, { status: 400 });
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
      return NextResponse.json({ error: "ImgBB API Key is not configured in server environment or admin configuration" }, { status: 500 });
    }

    // Convert to base64 for ImgBB payload
    let finalBase64 = "";
    let fileName = "uploaded_image";
    let mimeType = "image/png";
    let fileSize = 0;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      finalBase64 = buffer.toString("base64");
      fileName = file.name;
      mimeType = file.type || "image/png";
      fileSize = file.size;
    } else if (base64Data) {
      if (base64Data.startsWith("data:")) {
        const parts = base64Data.split(",");
        const header = parts[0];
        finalBase64 = parts[1] || "";
        const mimeMatch = header.match(/data:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
      } else {
        finalBase64 = base64Data;
      }
      fileSize = Math.round((finalBase64.length * 3) / 4);
    }

    if (!finalBase64) {
      return NextResponse.json({ error: "Empty or invalid image content" }, { status: 400 });
    }

    const uploadFormData = new FormData();
    uploadFormData.append("image", finalBase64);

    // CRITICAL: Notice NO 'expiration' parameter is appended to guarantee permanent retention
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
      mimeType: validation.mimeType || extractedMime || mimeType,
      fileSize: extractedSize || fileSize,
      uploadedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      status: "VERIFIED_ACTIVE",
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
