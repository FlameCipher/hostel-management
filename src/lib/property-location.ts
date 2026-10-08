import { z } from "zod";

// ISO 3166-1 alpha-2 country and territory codes; names are provided by Intl.
export const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const countries = new Set(COUNTRY_CODES);
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string | null | undefined) => code && countries.has(code) ? regionNames.of(code) || code : "";
export const countryOptions = COUNTRY_CODES.map(code => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
export function validTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return value === "UTC" || value.includes("/"); } catch { return false; }
}
const optionalCoordinate = (min: number, max: number) => z.preprocess(value => value === "" || value == null ? null : value, z.coerce.number().finite().min(min).max(max).nullable());
export const propertyLocationSchema = z.object({
  countryCode: z.string().trim().toUpperCase().refine(code => code === "" || countries.has(code), "Choose a valid country or territory."),
  city: z.string().trim().max(120),
  region: z.string().trim().max(120),
  postalCode: z.string().trim().max(32),
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
  timeZone: z.string().trim().max(100).refine(value => !value || validTimeZone(value), "Choose a valid location time zone."),
}).refine(value => (value.latitude === null) === (value.longitude === null), "Provide both latitude and longitude, or leave both blank.");

export type PropertyLocation = {
  physicalAddress?: string | null; countryCode?: string | null; city?: string | null;
  region?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null; timeZone?: string | null;
};
export function locationLabel(location: PropertyLocation): string {
  return [location.city, location.region, countryName(location.countryCode)].filter(Boolean).join(", ");
}
export function propertyMapUrl(location: PropertyLocation & { name: string }): string | null {
  const { latitude, longitude } = location;
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }
  if (!location.physicalAddress || !location.city || !countryName(location.countryCode)) return null;
  const query = [location.name, location.physicalAddress, locationLabel(location), location.postalCode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
