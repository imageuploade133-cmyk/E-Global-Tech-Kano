import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuth } from "@/lib/admin-auth";

export interface StoreCategoryDoc {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  backupUrl?: string;
  iconName?: string;
  isHidden?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_STORE_CATEGORIES: StoreCategoryDoc[] = [
  {
    id: "cat_all",
    name: "ALL",
    slug: "all",
    description: "All products in store",
    iconName: "grid_view",
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cat_electronics",
    name: "Electronics",
    slug: "electronics",
    description: "Consumer electronics and appliances",
    iconName: "devices",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cat_fashion",
    name: "Fashion",
    slug: "fashion",
    description: "Apparel, footwear and fashion accessories",
    iconName: "checkroom",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cat_utilities",
    name: "Airtime & Utilities",
    slug: "airtime-utilities",
    description: "Bills payment, airtime and data bundles",
    iconName: "receipt_long",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cat_giftcards",
    name: "Gift Cards",
    slug: "gift-cards",
    description: "Digital vouchers and gift cards",
    iconName: "card_giftcard",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cat_gadgets",
    name: "Gadgets & Phones",
    slug: "gadgets-phones",
    description: "Smartphones, tablets and wearable tech",
    iconName: "smartphone",
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function GET(req: Request) {
  try {
    const docRef = adminDb.collection("config").doc("store_data");
    const docSnap = await docRef.get();
    const data = docSnap.exists ? docSnap.data() || {} : {};

    let categories: StoreCategoryDoc[] = Array.isArray(data.categories) && data.categories.length > 0
      ? data.categories
      : DEFAULT_STORE_CATEGORIES;

    // Seed default categories if doc was empty
    if (!data.categories) {
      await docRef.set({ categories: DEFAULT_STORE_CATEGORIES }, { merge: true });
    }

    return NextResponse.json({
      success: true,
      categories,
      count: categories.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Store Categories GET Error]:", error.message);
    return NextResponse.json({ success: true, categories: DEFAULT_STORE_CATEGORIES, count: DEFAULT_STORE_CATEGORIES.length });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const body = await req.json();
    const { action, category, categoryId } = body;

    const docRef = adminDb.collection("config").doc("store_data");
    const docSnap = await docRef.get();
    const existingData = docSnap.exists ? docSnap.data() || {} : {};

    let categories: StoreCategoryDoc[] = Array.isArray(existingData.categories) && existingData.categories.length > 0
      ? [...existingData.categories]
      : [...DEFAULT_STORE_CATEGORIES];

    const now = new Date().toISOString();

    if (action === "add_category") {
      if (!category || !category.name) {
        return NextResponse.json({ error: "Category name is required." }, { status: 400 });
      }

      const name = category.name.trim();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      // Check duplicate slug
      const duplicate = categories.find((c) => c.slug === slug || c.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        return NextResponse.json({ error: `Category "${name}" already exists.` }, { status: 400 });
      }

      const newCategory: StoreCategoryDoc = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name,
        slug,
        description: (category.description || "").trim(),
        imageUrl: (category.imageUrl || "").trim(),
        backupUrl: (category.backupUrl || "").trim(),
        iconName: (category.iconName || "category").trim(),
        isHidden: Boolean(category.isHidden),
        sortOrder: typeof category.sortOrder === "number" ? category.sortOrder : categories.length,
        createdAt: now,
        updatedAt: now,
      };

      categories.push(newCategory);
    } else if (action === "edit_category") {
      if (!categoryId) {
        return NextResponse.json({ error: "categoryId is required for update." }, { status: 400 });
      }

      const index = categories.findIndex((c) => c.id === categoryId);
      if (index === -1) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }

      const existing = categories[index];
      const name = category.name ? category.name.trim() : existing.name;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      categories[index] = {
        ...existing,
        name,
        slug,
        description: category.description !== undefined ? category.description.trim() : existing.description,
        imageUrl: category.imageUrl !== undefined ? category.imageUrl.trim() : existing.imageUrl,
        backupUrl: category.backupUrl !== undefined ? category.backupUrl.trim() : existing.backupUrl,
        iconName: category.iconName !== undefined ? category.iconName.trim() : existing.iconName,
        isHidden: category.isHidden !== undefined ? Boolean(category.isHidden) : existing.isHidden,
        sortOrder: typeof category.sortOrder === "number" ? category.sortOrder : existing.sortOrder,
        updatedAt: now,
      };
    } else if (action === "delete_category") {
      if (!categoryId) {
        return NextResponse.json({ error: "categoryId is required for deletion." }, { status: 400 });
      }

      if (categoryId === "cat_all") {
        return NextResponse.json({ error: "Cannot delete the mandatory default 'ALL' category." }, { status: 400 });
      }

      categories = categories.filter((c) => c.id !== categoryId);
    } else if (action === "toggle_visibility") {
      if (!categoryId) {
        return NextResponse.json({ error: "categoryId is required." }, { status: 400 });
      }

      const index = categories.findIndex((c) => c.id === categoryId);
      if (index === -1) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }

      categories[index] = {
        ...categories[index],
        isHidden: !categories[index].isHidden,
        updatedAt: now,
      };
    } else {
      return NextResponse.json({ error: "Invalid category action specified." }, { status: 400 });
    }

    await docRef.set({ categories, updatedAt: now }, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Store category updated successfully!",
      categories,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Store Categories POST Error]:", error.message);
    return NextResponse.json({ error: "Failed to update store category", details: error.message }, { status: 500 });
  }
}
