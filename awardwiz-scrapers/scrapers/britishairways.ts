import { AwardWizScraper, FlightFare, FlightWithFares } from "../awardwiz-types.js"
import { ScraperMetadata } from "../../arkalis/arkalis.js"
import { BritishAirwaysResponse } from "../scraper-types/britishairways.js"

export const meta: ScraperMetadata = {
  name: "britishairways",
  blockUrls: [
    "googletagmanager.com", "google-analytics.com", "doubleclick.net",
    "facebook.com", "twitter.com", "linkedin.com", "hotjar.com"
  ]
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  // TODO: Research the correct British Airways Avios redemption API
  // BA uses Executive Club and Avios for award bookings
  
  // Placeholder URL structure - needs research  
  const url = `https://www.britishairways.com/en-gb/executive-club/spending-avios/flights?from=${query.origin}&to=${query.destination}&departure=${query.departureDate}&passengers=1&cabin=any`
  
  arkalis.goto(url)
  
  // TODO: Research the actual API endpoint they use for award searches
  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "*/flight-search*", onlyStatusCode: 200, othersThrow: true },
    "no_availability": { type: "html", html: "No award seats available" },
    "invalid_route": { type: "html", html: "not available on this route" },
    "login_required": { type: "html", html: "sign in to your Executive Club account" },
  })
  
  if (waitForResult.name !== "success") {
    return arkalis.warn(waitForResult.name)
  }
  
  const response = JSON.parse(waitForResult.response!.body) as BritishAirwaysResponse
  
  arkalis.log("parsing results") 
  const results = standardizeResults(response, query)
  return results
}

const standardizeResults = (raw: BritishAirwaysResponse, query: any): FlightWithFares[] => {
  const results: FlightWithFares[] = []
  
  // TODO: Implement parsing logic once BA API structure is known
  // Will need to convert BA's response format to our FlightWithFares format
  // BA uses Avios instead of miles, so will need to handle that conversion
  
  return results
}