// Verified on the signed-in SAMPESA merchant dashboard, 31 October 2026.
// Hosted collection only: opening or returning from this page never posts a ledger payment.
export const MMAMBUGUA_RENT_URL = "https://store.pesapal.com/mmambuguahostelrent";
export const MMAMBUGUA_RENT_GUIDE_URL = "https://mmambugua.studentshostels.com/pay-rent";

export function hostelRentCollection(organizationId: string, currency: string) {
  if (organizationId !== "mama-mbugua-hostel" || currency !== "KES") return null;
  return { url: MMAMBUGUA_RENT_URL, guideUrl: MMAMBUGUA_RENT_GUIDE_URL, merchant: "Sampesa Group Limited" };
}
