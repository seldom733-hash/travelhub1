import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from "class-validator";
import { CategoryStatus } from "../../generated/prisma/enums";
import { LocalizedNamesDto } from "../geo/geo.dto";

export class CreateDirectoryEntryDto {
  @IsString()
  @Length(1, 32, { message: "code: 1-32 chars" })
  @Matches(/^[A-Z0-9*+\-]+$/, { message: "code: A-Z 0-9 * + -" })
  code!: string;

  @IsObject()
  names!: LocalizedNamesDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}

export class UpdateDirectoryEntryDto {
  @IsOptional()
  @IsObject()
  names?: LocalizedNamesDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}
