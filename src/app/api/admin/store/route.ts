import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuth } from "@/lib/admin-auth";

const DEFAULT_SETTINGS = {
  storeName: "E-Tech Store",
  storeLogoUrl: "",
  borderColor: "#FC7A00",
  hideBorders: false,
  orderStatuses: ["Pending", "Processing", "Shipped", "Delivered", "Refunded", "Canceled"],
};

export async function GET(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const docSnap = await adminDb.collection("config").doc("store_data").get();
    const data = docSnap.exists ? docSnap.data() || {} : {};

    return NextResponse.json({
      success: true,
      items: data.items || [],
      slides: data.slides || [],
      categories: data.categories || [],
      settings: data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Store GET Error]:", error.message);
    return NextResponse.json({ error: "Failed to fetch store data", details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const body = await req.json();
    const { action, item, slide, itemId, slideId, settings } = body;

    const docRef = adminDb.collection("config").doc("store_data");
    const docSnap = await docRef.get();
    const existingData = docSnap.exists ? docSnap.data() || {} : {};

    let items = Array.isArray(existingData.items) ? [...existingData.items] : [];
    let slides = Array.isArray(existingData.slides) ? [...existingData.slides] : [];
    let currentSettings = existingData.settings
      ? { ...DEFAULT_SETTINGS, ...existingData.settings }
      : { ...DEFAULT_SETTINGS };

    const now = new Date().toISOString();

    if (action === "add_item" || action === "edit_item") {
      if (!item || !item.title) {
        return NextResponse.json({ error: "Item title is required." }, { status: 400 });
      }

      const imagesArray: string[] = Array.isArray(item.images)
        ? item.images.map((img: string) => String(img).trim()).filter(Boolean)
        : (item.imageUrl ? [String(item.imageUrl).trim()] : []);

      const primaryImg = item.coverImageUrl
        ? String(item.coverImageUrl).trim()
        : (imagesArray[0] || (item.imageUrl ? String(item.imageUrl).trim() : ""));

      if (action === "edit_item" && item.id) {
        items = items.map((i: any) => {
          if (i.id === item.id) {
            return {
              ...i,
              title: item.title.trim(),
              description: (item.description || "").trim(),
              costPrice: typeof item.costPrice === "number" ? item.costPrice : (item.costPrice ? Number(item.costPrice) : null),
              price: Number(item.price) || 0,
              discountPrice: typeof item.discountPrice === "number" ? item.discountPrice : (item.discountPrice ? Number(item.discountPrice) : null),
              category: (item.category || "General").trim(),
              imageUrl: primaryImg,
              images: imagesArray,
              coverImageUrl: primaryImg,
              videoUrl: (item.videoUrl || "").trim(),
              autoSlide: Boolean(item.autoSlide),
              inStock: item.inStock !== false,
              stockQuantity: typeof item.stockQuantity === "number" ? item.stockQuantity : (item.stockQuantity ? Number(item.stockQuantity) : null),
              unlimitedStock: Boolean(item.unlimitedStock),
              updatedAt: now,
            };
          }
          return i;
        });
      } else {
        const newItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title: item.title.trim(),
          description: (item.description || "").trim(),
          costPrice: typeof item.costPrice === "number" ? item.costPrice : (item.costPrice ? Number(item.costPrice) : null),
          price: Number(item.price) || 0,
          discountPrice: typeof item.discountPrice === "number" ? item.discountPrice : (item.discountPrice ? Number(item.discountPrice) : null),
          category: (item.category || "General").trim(),
          imageUrl: primaryImg,
          images: imagesArray,
          coverImageUrl: primaryImg,
          videoUrl: (item.videoUrl || "").trim(),
          autoSlide: Boolean(item.autoSlide),
          inStock: item.inStock !== false,
          stockQuantity: typeof item.stockQuantity === "number" ? item.stockQuantity : (item.stockQuantity ? Number(item.stockQuantity) : null),
          unlimitedStock: Boolean(item.unlimitedStock),
          createdAt: now,
          updatedAt: now,
        };
        items.unshift(newItem);
      }
    } else if (action === "delete_item") {
      if (!itemId) {
        return NextResponse.json({ error: "itemId is required for deletion." }, { status: 400 });
      }
      items = items.filter((i: any) => i.id !== itemId);
    } else if (action === "add_slide") {
      if (!slide || !slide.imageUrl) {
        return NextResponse.json({ error: "Slide image URL is required." }, { status: 400 });
      }
      const newSlide = {
        id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        imageUrl: slide.imageUrl.trim(),
        title: (slide.title || "").trim(),
        subtitle: (slide.subtitle || "").trim(),
        link: (slide.link || "").trim(),
        createdAt: now,
        updatedAt: now,
      };
      slides.unshift(newSlide);
    } else if (action === "delete_slide") {
      if (!slideId) {
        return NextResponse.json({ error: "slideId is required for deletion." }, { status: 400 });
      }
      slides = slides.filter((s: any) => s.id !== slideId);
    } else if (action === "update_settings") {
      if (!settings) {
        return NextResponse.json({ error: "settings payload is required." }, { status: 400 });
      }

      currentSettings = {
        storeName: settings.storeName !== undefined ? String(settings.storeName).trim() : currentSettings.storeName,
        storeLogoUrl: settings.storeLogoUrl !== undefined ? String(settings.storeLogoUrl).trim() : currentSettings.storeLogoUrl,
        borderColor: (settings.borderColor || currentSettings.borderColor).trim(),
        hideBorders: settings.hideBorders !== undefined ? Boolean(settings.hideBorders) : currentSettings.hideBorders,
        orderStatuses: Array.isArray(settings.orderStatuses) && settings.orderStatuses.length > 0
          ? settings.orderStatuses.map((s: string) => s.trim()).filter(Boolean)
          : currentSettings.orderStatuses,
      };
    } else {
      return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
    }

    await docRef.set(
      {
        items,
        slides,
        settings: currentSettings,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "Store data updated successfully!",
      items,
      slides,
      settings: currentSettings,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Store POST Error]:", error.message);
    return NextResponse.json({ error: "Failed to update store data", details: error.message }, { status: 500 });
  }
}
