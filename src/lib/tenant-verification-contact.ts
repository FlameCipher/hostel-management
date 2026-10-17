import { whatsappNumber } from "./whatsapp-policy";
import { registrationCountryCode } from "./tenant-registration";

export function registeredResidentCallTarget(
  phone: string | null | undefined,
  countryCode: string | null | undefined,
  organizationId: string,
): {display:string;href:string}|null {
  const digits=whatsappNumber(phone,registrationCountryCode(countryCode,organizationId));
  return digits?{display:"+"+digits,href:"tel:+"+digits}:null;
}
