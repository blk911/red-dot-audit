import RedDotExperience from "./red-dot-experience";
import { getCommerceReadiness } from "@/lib/commerce/config";
import { CHARTER_AUTOPSY_ENDS_AT, CHARTER_AUTOPSY_LIMIT, getCharterOfferStatus } from "@/lib/commerce/charter-offer";

export default async function Home() {
  const charterOffer = await getCharterOfferStatus().catch(() => ({
    active: false,
    sold: 0,
    remaining: 0,
    limit: CHARTER_AUTOPSY_LIMIT,
    endsAt: CHARTER_AUTOPSY_ENDS_AT,
  }));
  return (
    <RedDotExperience
      commerceReadiness={getCommerceReadiness()}
      charterOffer={charterOffer}
    />
  );
}
