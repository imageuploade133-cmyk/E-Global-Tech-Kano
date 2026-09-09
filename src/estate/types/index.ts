export type PropertyPurpose = "Rent" | "Sale" | "Short-let";

export type PropertyType =
  | "Apartment"
  | "House"
  | "Duplex"
  | "Villa"
  | "Land"
  | "Shop"
  | "Office"
  | "Commercial property"
  | "Other";

export type PropertyStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "RENTED"
  | "SOLD"
  | "ARCHIVED";

export interface EstateProperty {
  id: string;
  sellerId: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  title: string;
  description: string;
  purpose: PropertyPurpose;
  propertyType: PropertyType;
  price: number;
  currency: string;
  pricePeriod?: "year" | "month" | "night" | "total";
  location: {
    address: string;
    city: string;
    state: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  propertySize?: string;
  furnished?: "Fully Furnished" | "Semi Furnished" | "Unfurnished";
  amenities: string[];
  images: string[];
  videos?: string[];
  status: PropertyStatus;
  verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED";
  featured?: boolean;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface EstateSeller {
  uid: string;
  displayName: string;
  agencyName?: string;
  phone: string;
  email: string;
  address?: string;
  avatarUrl?: string;
  isVerified: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  idDocumentUrl?: string;
  totalListings?: number;
  bannedFromPublishing?: boolean;
  banReason?: string;
  publishingRestricted?: boolean;
  restrictedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EstateInquiry {
  id: string;
  propertyId: string;
  propertyTitle: string;
  sellerId: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  message: string;
  status: "NEW" | "READ" | "CONTACTED";
  createdAt: string;
}

export interface EstateFavorite {
  id: string;
  userId: string;
  propertyId: string;
  savedAt: string;
}

export interface EstateReport {
  id: string;
  propertyId: string;
  propertyTitle: string;
  reporterUserId: string;
  reason: string;
  details?: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
}

export interface EstateCategory {
  id: string;
  name: PropertyType;
  iconName?: string;
  imageUrl?: string;
  isHidden?: boolean;
}

export interface EstateSettings {
  featuredFee?: number;
  agentRegistrationFee?: number;
  autoApproveVerifiedSellers?: boolean;
  supportPhone?: string;
  supportEmail?: string;
}
