CREATE UNIQUE INDEX "RoomType_id_organizationId_key" ON "RoomType"("id", "organizationId");
CREATE TABLE "BookingRequest" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
 "roomTypeId" TEXT NOT NULL, "requestId" TEXT NOT NULL, "reference" TEXT NOT NULL,
 "fullName" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT,
 "preferredMoveIn" DATE NOT NULL, "contactKey" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'REQUESTED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BookingRequest_status_check" CHECK ("status" IN ('REQUESTED','CONTACTED','CLOSED')),
 CONSTRAINT "BookingRequest_property_fkey" FOREIGN KEY ("propertyId","organizationId") REFERENCES "Property"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingRequest_roomType_fkey" FOREIGN KEY ("roomTypeId","organizationId") REFERENCES "RoomType"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BookingRequest_reference_key" ON "BookingRequest"("reference");
CREATE UNIQUE INDEX "BookingRequest_propertyId_requestId_key" ON "BookingRequest"("propertyId","requestId");
CREATE INDEX "BookingRequest_organizationId_status_createdAt_idx" ON "BookingRequest"("organizationId","status","createdAt");
CREATE INDEX "BookingRequest_propertyId_contactKey_createdAt_idx" ON "BookingRequest"("propertyId","contactKey","createdAt");
