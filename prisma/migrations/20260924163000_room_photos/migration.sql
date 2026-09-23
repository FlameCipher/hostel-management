CREATE TYPE "RoomPhotoType" AS ENUM ('INSIDE','OUTSIDE','COMPOUND');
CREATE TABLE "RoomPhoto" ("id" TEXT NOT NULL,"roomId" TEXT NOT NULL,"type" "RoomPhotoType" NOT NULL,"url" TEXT NOT NULL,"pathname" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "RoomPhoto_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RoomPhoto_roomId_type_key" ON "RoomPhoto"("roomId","type");
CREATE INDEX "RoomPhoto_roomId_idx" ON "RoomPhoto"("roomId");
ALTER TABLE "RoomPhoto" ADD CONSTRAINT "RoomPhoto_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
