import { describe, expect, test } from "bun:test";
import { EstateProperty } from "../src/estate/types";

describe("Estate Marketplace Architectural Suite", () => {
  test("Estate property object contains required status and security fields", () => {
    const property: EstateProperty = {
      id: "prop_123",
      sellerId: "seller_456",
      sellerName: "Apex Realty Agent",
      sellerPhone: "08012345678",
      sellerEmail: "agent@apexrealty.com",
      title: "Luxury 4 Bedroom Duplex in Lekki Phase 1",
      description: "Modern duplex with swimming pool and 24/7 solar power.",
      purpose: "Rent",
      propertyType: "Duplex",
      price: 5500000,
      currency: "NGN",
      pricePeriod: "year",
      location: {
        address: "Admiralty Way, Lekki Phase 1",
        city: "Lagos",
        state: "Lagos",
      },
      bedrooms: 4,
      bathrooms: 4,
      toilets: 5,
      propertySize: "450 sqm",
      furnished: "Fully Furnished",
      amenities: ["Swimming Pool", "24/7 Power", "Security"],
      images: ["https://i.ibb.co/duplex1.jpg"],
      status: "PENDING_REVIEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(property.id).toBe("prop_123");
    expect(property.sellerId).toBe("seller_456");
    expect(property.purpose).toBe("Rent");
    expect(property.status).toBe("PENDING_REVIEW");
    expect(property.price).toBe(5500000);
    expect(property.amenities.length).toBe(3);
  });
});
