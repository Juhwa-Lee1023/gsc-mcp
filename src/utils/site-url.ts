import { createDomainError } from "../domain/errors.js";
import type { AppConfig, PropertyConfig, ResolvedProperty } from "../domain/types.js";

export function normalizeSiteUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim();
  if (trimmed.startsWith("sc-domain:")) {
    const host = trimmed.slice("sc-domain:".length).trim().replace(/\/+$/, "").toLowerCase();
    if (!host) {
      throw createDomainError("INVALID_SITE_URL", "Invalid domain property.", false, { siteUrl });
    }
    return `sc-domain:${host}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw createDomainError("INVALID_SITE_URL", "Invalid URL-prefix property.", false, { siteUrl });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw createDomainError("INVALID_SITE_URL", "Only http/https URL-prefix properties are supported.", false, { siteUrl });
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  return parsed.toString();
}

export function resolvePropertyConfig(property: PropertyConfig): ResolvedProperty {
  const canonicalSiteUrl = normalizeSiteUrl(property.siteUrl);
  if (canonicalSiteUrl.startsWith("sc-domain:")) {
    return {
      ...property,
      canonicalSiteUrl,
      propertyType: "domain",
      host: canonicalSiteUrl.replace("sc-domain:", ""),
      prefixPath: "/",
    };
  }
  const parsed = new URL(canonicalSiteUrl);
  return {
    ...property,
    canonicalSiteUrl,
    propertyType: "url-prefix",
    host: parsed.hostname,
    prefixPath: parsed.pathname,
  };
}

export function resolveAllowedProperty(config: AppConfig, selector: string): ResolvedProperty {
  const byAlias = config.properties.find((property) => property.alias === selector);
  if (byAlias) {
    return resolvePropertyConfig(byAlias);
  }
  const canonical = normalizeSiteUrl(selector);
  const bySite = config.properties.find((property) => normalizeSiteUrl(property.siteUrl) === canonical);
  if (!bySite) {
    throw createDomainError("PROPERTY_NOT_ALLOWED", "The requested property is not allowlisted.", false, {
      selector,
      canonical,
    });
  }
  return resolvePropertyConfig(bySite);
}

export function assertUrlWithinProperty(inspectionUrl: string, property: ResolvedProperty): URL {
  let candidate: URL;
  try {
    candidate = new URL(inspectionUrl);
  } catch {
    throw createDomainError("INVALID_ARGUMENT", "Inspection URL is invalid.", false, { inspectionUrl });
  }
  candidate.hash = "";
  candidate.hostname = candidate.hostname.toLowerCase();

  if (property.propertyType === "domain") {
    if (candidate.hostname !== property.host && !candidate.hostname.endsWith(`.${property.host}`)) {
      throw createDomainError("URL_OUTSIDE_PROPERTY", "Inspection URL is outside the selected domain property.", false, {
        inspectionUrl,
        site: property.canonicalSiteUrl,
      });
    }
    return candidate;
  }

  if (!candidate.toString().startsWith(property.canonicalSiteUrl)) {
    throw createDomainError("URL_OUTSIDE_PROPERTY", "Inspection URL is outside the selected URL-prefix property.", false, {
      inspectionUrl,
      site: property.canonicalSiteUrl,
    });
  }

  return candidate;
}
