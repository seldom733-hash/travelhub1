-- AlterTable
ALTER TABLE "catalog"."PublicSellerProfile" DROP COLUMN "cityLabel",
DROP COLUMN "countryLabel",
ADD COLUMN     "cityCode" TEXT,
ADD COLUMN     "countryCode" TEXT;

-- AlterTable
ALTER TABLE "catalog"."PublicSellerProfileProposal" DROP COLUMN "requestedCityLabel",
DROP COLUMN "requestedCountryLabel",
ADD COLUMN     "requestedCityCode" TEXT;

-- AlterTable
ALTER TABLE "crm"."Partner" ADD COLUMN     "countryCode" TEXT;

