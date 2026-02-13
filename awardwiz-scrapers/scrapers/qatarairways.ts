import { AwardWizScraper, FlightFare, FlightWithFares } from "../awardwiz-types.js"
import { ScraperMetadata } from "../../arkalis/arkalis.js"
import { QatarAirwaysResponse } from "../scraper-types/qatarairways.js"

export const meta: ScraperMetadata = {
  name: "qatarairways", 
  blockUrls: [
    "googletagmanager.com", "google-analytics.com", "doubleclick.net",
    "facebook.com", "twitter.com", "linkedin.com", "tealium.com"
  ]
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  // TODO: Research the correct Qatar Airways Privilege Club API
  // QR uses Privilege Club Qmiles for award redemptions
  
  // Placeholder URL structure - needs research
  const url = `https://www.qatarairways.com/en/offers/qmiles-awards.html?origin=${query.origin}&destination=${query.destination}&departure=${query.departureDate}&passengers=1&cabin=all`
  
  arkalis.goto(url)
  
  // TODO: Research the actual API endpoint they use for award searches
  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "*/booking/search*", onlyStatusCode: 200, othersThrow: true },
    "no_award_seats": { type: "html", html: "No award seats available" },
    "route_not_served": { type: "html", html: "route is not available" },
    "login_required": { type: "html", html: "Please log in to your Privilege Club account" },
  })
  
  if (waitForResult.name !== "success") {
    return arkalis.warn(waitForResult.name)
  }
  
  const response = JSON.parse(waitForResult.response!.body) as QatarAirwaysResponse
  
  arkalis.log("parsing results")
  const results = standardizeResults(response, query)
  return results
}

const standardizeResults = (raw: QatarAirwaysResponse, query: any): FlightWithFares[] => {
  const results: FlightWithFares[] = []
  
  // TODO: Implement parsing logic once QR API structure is known
  // Will need to convert QR's Qmiles to our standard miles format
  // QR has excellent premium cabins (Qsuites) that should be captured
  
  return results
}