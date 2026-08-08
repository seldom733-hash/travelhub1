import { ValidationDomainError } from "../../shared/errors";

/**
 * Category Schema foundation (Step 1.1) — чистые функции валидации.
 *
 * Один универсальный `Catalog.Product`: category-specific attributes хранятся в
 * JSONB и ОБЯЗАТЕЛЬНО валидируются по ACTIVE Category Schema категории —
 * произвольный бесконтрольный JSON не принимается.
 *
 * Attribute types: string | text | number | integer | boolean | date | time |
 *                  enum | currency
 */

export const ATTRIBUTE_TYPES = [
  "string",
  "text",
  "number",
  "integer",
  "boolean",
  "date",
  "time",
  "enum",
  "currency",
] as const;

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export interface AttributeDef {
  key: string;
  label?: string;
  type: AttributeType;
  required?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  /** Для type = "enum": допустимые значения. */
  options?: string[];
  /** Для number/integer: диапазон. */
  min?: number;
  max?: number;
  /** Для string/text/currency/time: regex. */
  pattern?: string;
}

export interface MediaRequirements {
  minImages?: number;
  maxImages?: number;
  primaryImageRequired?: boolean;
  allowedMediaTypes?: string[];
  videoAllowed?: boolean;
}

export interface CategorySchemaConfig {
  attributes: AttributeDef[];
  availability?: Record<string, unknown> | null;
  tariffRules?: Record<string, unknown> | null;
  mediaRequirements?: MediaRequirements | null;
  pdpSections?: string[] | null;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isMissing = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Стабильный технический slug категории: lowercase alnum + одиночные дефисы. */
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Валидация технического идентификатора категории (Step 1.1 review fix).
 * Slug — НЕ display title: передаётся явно, стабилен, не меняется при изменении title.
 */
export function validateCategorySlug(slug: unknown): string {
  if (typeof slug !== "string" || slug.length < 2 || slug.length > 64 || !CATEGORY_SLUG_PATTERN.test(slug)) {
    throw new ValidationDomainError(
      `Invalid category slug: use 2-64 lowercase latin letters/digits with single hyphens (e.g. "car-rental")`,
    );
  }
  return slug;
}

/**
 * Валидация конфигурации Category Schema (при создании/редактировании схемы).
 * Нормализует и возвращает валидный CategorySchemaConfig.
 */
export function validateSchemaConfig(input: unknown): CategorySchemaConfig {
  if (!isPlainObject(input)) {
    throw new ValidationDomainError("Category Schema config must be an object");
  }
  const { attributes, availability, tariffRules, mediaRequirements, pdpSections } = input;

  if (!Array.isArray(attributes)) {
    throw new ValidationDomainError("Category Schema attributes must be an array");
  }

  const defs = attributes.map((raw, index) => {
    if (!isPlainObject(raw)) {
      throw new ValidationDomainError(`attributes[${index}] must be an object`);
    }
    const key = raw.key;
    if (typeof key !== "string" || key.trim() === "") {
      throw new ValidationDomainError(`attributes[${index}].key must be a non-empty string`);
    }
    const type = raw.type;
    if (typeof type !== "string" || !(ATTRIBUTE_TYPES as readonly string[]).includes(type)) {
      throw new ValidationDomainError(
        `attribute "${key}": invalid type "${String(type)}" (allowed: ${ATTRIBUTE_TYPES.join(", ")})`,
      );
    }
    if (type === "enum") {
      if (!Array.isArray(raw.options) || raw.options.length === 0) {
        throw new ValidationDomainError(`attribute "${key}": enum requires non-empty options`);
      }
      if (!raw.options.every((o) => typeof o === "string")) {
        throw new ValidationDomainError(`attribute "${key}": enum options must be strings`);
      }
    }
    const def: AttributeDef = {
      key,
      label: typeof raw.label === "string" ? raw.label : undefined,
      type: type as AttributeType,
      required: raw.required === true,
      searchable: raw.searchable === true,
      filterable: raw.filterable === true,
      options: type === "enum" ? (raw.options as string[]) : undefined,
      min: typeof raw.min === "number" ? raw.min : undefined,
      max: typeof raw.max === "number" ? raw.max : undefined,
      pattern: typeof raw.pattern === "string" ? raw.pattern : undefined,
    };
    return def;
  });

  const keys = new Set(defs.map((d) => d.key));
  if (keys.size !== defs.length) {
    throw new ValidationDomainError("Category Schema attributes must have unique keys");
  }

  // mediaRequirements — только конфигурация для Step 1.2 (media functionality НЕ реализуется).
  let media: MediaRequirements | null = null;
  if (mediaRequirements !== undefined && mediaRequirements !== null) {
    if (!isPlainObject(mediaRequirements)) {
      throw new ValidationDomainError("mediaRequirements must be an object");
    }
    media = {
      minImages: typeof mediaRequirements.minImages === "number" ? mediaRequirements.minImages : undefined,
      maxImages: typeof mediaRequirements.maxImages === "number" ? mediaRequirements.maxImages : undefined,
      primaryImageRequired: mediaRequirements.primaryImageRequired === true,
      allowedMediaTypes: Array.isArray(mediaRequirements.allowedMediaTypes)
        ? mediaRequirements.allowedMediaTypes.filter((m) => typeof m === "string")
        : undefined,
      videoAllowed: mediaRequirements.videoAllowed === true,
    };
    if (media.minImages !== undefined && media.maxImages !== undefined && media.minImages > media.maxImages) {
      throw new ValidationDomainError("mediaRequirements.minImages must not exceed maxImages");
    }
  }

  let sections: string[] | null = null;
  if (pdpSections !== undefined && pdpSections !== null) {
    if (!Array.isArray(pdpSections) || !pdpSections.every((s) => typeof s === "string" && s.trim() !== "")) {
      throw new ValidationDomainError("pdpSections must be an array of non-empty strings");
    }
    sections = pdpSections as string[];
  }

  return {
    attributes: defs,
    availability: isPlainObject(availability) ? availability : null,
    tariffRules: isPlainObject(tariffRules) ? tariffRules : null,
    mediaRequirements: media,
    pdpSections: sections,
  };
}

/**
 * Валидация product attributes по ACTIVE Category Schema.
 * Бросает ValidationDomainError (422) при: неизвестном attribute, неверном типе,
 * отсутствии обязательного attribute, нарушении enum/min/max/pattern.
 * Возвращает провалидированный объект values.
 */
export function validateAttributes(
  schema: Pick<CategorySchemaConfig, "attributes">,
  attributes: unknown,
): Record<string, unknown> {
  if (attributes === undefined || attributes === null) {
    attributes = {};
  }
  if (!isPlainObject(attributes)) {
    throw new ValidationDomainError("Product attributes must be an object");
  }

  const defs = schema.attributes;
  const byKey = new Map(defs.map((d) => [d.key, d]));

  // 1) Неизвестные ключи — запрещены (нет бесконтрольного JSON).
  for (const key of Object.keys(attributes)) {
    if (!byKey.has(key)) {
      throw new ValidationDomainError(`Unknown attribute "${key}" is not allowed by the category schema`);
    }
  }

  // 2) Обязательные атрибуты.
  for (const def of defs) {
    if (def.required && isMissing(attributes[def.key])) {
      throw new ValidationDomainError(`Required attribute "${def.key}" is missing`);
    }
  }

  // 3) Типы / enum / диапазоны / pattern.
  for (const def of defs) {
    const value = attributes[def.key];
    if (isMissing(value)) continue;

    switch (def.type) {
      case "string":
      case "text":
      case "currency":
      case "time":
        if (typeof value !== "string") {
          throw new ValidationDomainError(`Attribute "${def.key}" must be a string`);
        }
        if (def.pattern && !new RegExp(def.pattern).test(value)) {
          throw new ValidationDomainError(`Attribute "${def.key}" does not match required pattern`);
        }
        break;
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new ValidationDomainError(`Attribute "${def.key}" must be a number`);
        }
        break;
      case "integer":
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new ValidationDomainError(`Attribute "${def.key}" must be an integer`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw new ValidationDomainError(`Attribute "${def.key}" must be a boolean`);
        }
        break;
      case "date": {
        const ok =
          value instanceof Date
            ? !Number.isNaN(value.getTime())
            : typeof value === "string" && !Number.isNaN(Date.parse(value));
        if (!ok) {
          throw new ValidationDomainError(`Attribute "${def.key}" must be a valid date`);
        }
        break;
      }
      case "enum":
        if (typeof value !== "string" || !def.options?.includes(value)) {
          throw new ValidationDomainError(
            `Attribute "${def.key}" must be one of: ${(def.options ?? []).join(", ")}`,
          );
        }
        break;
    }

    if ((def.type === "number" || def.type === "integer") && typeof value === "number") {
      if (def.min !== undefined && value < def.min) {
        throw new ValidationDomainError(`Attribute "${def.key}" must be >= ${def.min}`);
      }
      if (def.max !== undefined && value > def.max) {
        throw new ValidationDomainError(`Attribute "${def.key}" must be <= ${def.max}`);
      }
    }
  }

  return attributes as Record<string, unknown>;
}
