import { Controller, Get, Query } from "@nestjs/common";
import { IsIn, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { Public } from "../../../security/auth/decorators";
import { PublicSuggestService } from "./public-suggest.service";

const SUGGEST_TYPES = ["destination", "hotel", "tour", "service", "all"] as const;

export class PublicSuggestDto {
  @IsString()
  @MinLength(2)
  q!: string;

  @IsOptional()
  @IsString()
  @IsIn(SUGGEST_TYPES)
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(10)
  limit?: number;
}

@Controller()
export class PublicSuggestController {
  constructor(private readonly suggestService: PublicSuggestService) {}

  @Get("public/suggest")
  @Public()
  suggest(@Query() query: PublicSuggestDto) {
    const q = query.q.trim();
    const type = query.type ?? "all";
    const limit = query.limit ?? 5;

    return this.suggestService.suggest(q, type, limit).then((results) => ({
      query: q,
      results,
      total: results.length,
    }));
  }
}
