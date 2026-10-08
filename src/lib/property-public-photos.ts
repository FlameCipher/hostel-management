import { cache } from "react";
import { db } from "@/lib/db";
import { publishedWhere } from "@/lib/property-host-policy";
export const publicPropertyPhotos = cache((propertyId: string, organizationId: string) => db.propertyPhoto.findMany({ where: { propertyId, organizationId, deletedAt: null, visible: true, url: { not: null }, property: publishedWhere() }, select: { id: true, url: true, caption: true, isCover: true }, orderBy: [{ isCover: "desc" }, { createdAt: "asc" }], take: 12 }));
