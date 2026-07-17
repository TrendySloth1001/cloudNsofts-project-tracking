-- CreateTable
CREATE TABLE "device_auths" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedUserId" TEXT,
    "tokenName" TEXT NOT NULL DEFAULT 'Coding agent',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_auths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_auths_deviceCodeHash_key" ON "device_auths"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "device_auths_userCode_key" ON "device_auths"("userCode");
