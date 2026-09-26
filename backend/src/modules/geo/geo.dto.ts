import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { GeoStatus } from "../../generated/prisma/enums";

export class LocalizedNamesDto {
  @IsString()
  ru!: string;

  @IsString()
  en!: string;

  @IsString()
  az!: string;
}

const CODE_MESSAGE = "code: 2-16 chars, A-Z 0-9 -";

export class CreateCountryDto {
  @IsString()
  @Length(2, 2, { message: "code must be ISO 3166-1 alpha-2" })
  @Matches(/^[A-Z]{2}$/, { message: "code must be ISO 3166-1 alpha-2" })
  code!: string;

  @IsObject()
  names!: LocalizedNamesDto;

  @IsOptional()
  @IsEnum(GeoStatus)
  status?: GeoStatus;
}

export class UpdateCountryDto {
  @IsOptional()
  @IsObject()
  names?: LocalizedNamesDto;

  @IsOptional()
  @IsEnum(GeoStatus)
  status?: GeoStatus;
}

class PlaceCreateDto {
  @IsString()
  @Length(2, 16, { message: CODE_MESSAGE })
  @Matches(/^[A-Z0-9-]+$/, { message: CODE_MESSAGE })
  code!: string;

  @IsObject()
  names!: LocalizedNamesDto;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsEnum(GeoStatus)
  status?: GeoStatus;
}

class PlaceUpdateDto {
  @IsOptional()
  @IsObject()
  names?: LocalizedNamesDto;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsEnum(GeoStatus)
  status?: GeoStatus;
}

export class CreateCityDto extends PlaceCreateDto {
  @IsString()
  countryId!: string;
}

export class UpdateCityDto extends PlaceUpdateDto {}

export class CreateResortDto extends PlaceCreateDto {
  @IsString()
  cityId!: string;
}

export class UpdateResortDto extends PlaceUpdateDto {}

export class CreateAirportDto extends PlaceCreateDto {
  @IsString()
  cityId!: string;

  @IsOptional()
  @IsString()
  timeZone?: string;
}

export class UpdateAirportDto extends PlaceUpdateDto {
  @IsOptional()
  @IsString()
  timeZone?: string;
}
