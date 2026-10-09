import { cache } from "react";
import { db } from "@/lib/db";
import { publishedWhere } from "@/lib/property-host-policy";
export const publicPropertyPhotos = cache((propertyId: string, organizationId: string) => db.propertyPhoto.findMany({
  where: { propertyId, organizationId, deletedAt: null, visible: true, confirmedAt: { not: null }, url: { not: null }, property: publishedWhere(), OR: [{ category: { in: ["EXTERIOR", "COMPOUND"] }, roomTypeId: null }, { category: "ROOM", roomType: { organizationId, active: true } }] },
  select: { id: true, url: true, caption: true, isCover: true, category: true, roomTypeId: true, roomType: { select: { name: true, sharingMode: true } } },
  orderBy: [{ isCover: "desc" }, { createdAt: "asc" }], take: 200,
}));
