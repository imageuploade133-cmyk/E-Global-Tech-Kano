import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_STORE_CATEGORIES } from "@/lib/store-defaults";

export async function GET() {
  try {
    const docSnap = await adminDb.collection("config").doc("store_data").get();
    const data = docSnap.exists ? docSnap.data() || {} : {};

    const categories = Array.isArray(data.categories) && data.categories.length > 0
      ? data.categories
      : DEFAULT_STORE_CATEGORIES;

    const defaultItems = [
      {
        id: "prod_1",
        title: "E-Tech Smart POS Terminal V2",
        description: "High-speed Android POS terminal with printer and dual SIM 4G support.",
        price: 85000,
        category: "Electronics",
        imageUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        inStock: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "prod_2",
        title: "E-Tech Merchant Smartwatch",
        description: "Receive instant payment alert notifications directly on your wrist.",
        price: 35000,
        category: "Gadgets & Phones",
        imageUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const defaultSlides = [
      {
        id: "slide_1",
        imageUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        title: "Welcome to E-Tech Store",
        subtitle: "Order hardware, gear, and POS terminals with instant wallet delivery.",
        link: "/store",
        isCrop: false,
        marginBottom: 20,
        mobileHeight: 176,
        desktopHeight: 220,
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      items: Array.isArray(data.items) && data.items.length > 0 ? data.items : defaultItems,
      slides: Array.isArray(data.slides) && data.slides.length > 0 ? data.slides : defaultSlides,
      categories,
      settings: data.settings || { storeName: "E-Tech Store", storeLogoUrl: "", borderColor: "#FC7A00", hideBorders: false },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Store GET Error]:", error.message);

    const fallbackItems = [
      {
        id: "prod_1",
        title: "E-Tech Smart POS Terminal V2",
        description: "High-speed Android POS terminal with printer and dual SIM 4G support.",
        price: 85000,
        category: "Electronics",
        imageUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        inStock: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "prod_2",
        title: "E-Tech Merchant Smartwatch",
        description: "Receive instant payment alert notifications directly on your wrist.",
        price: 35000,
        category: "Gadgets & Phones",
        imageUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const fallbackSlides = [
      {
        id: "slide_1",
        imageUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        title: "Welcome to E-Tech Store",
        subtitle: "Order hardware, gear, and POS terminals with instant wallet delivery.",
        link: "/store",
        isCrop: false,
        marginBottom: 20,
        mobileHeight: 176,
        desktopHeight: 220,
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      items: fallbackItems,
      slides: fallbackSlides,
      categories: DEFAULT_STORE_CATEGORIES,
      settings: { storeName: "E-Tech Store", storeLogoUrl: "", borderColor: "#FC7A00", hideBorders: false },
    });
  }
}
