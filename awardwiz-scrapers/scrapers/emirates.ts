import { AwardWizScraper, FlightFare, FlightWithFares } from "../awardwiz-types.js"
import { ScraperMetadata } from "../../arkalis/arkalis.js"
import { EmiratesResponse } from "../scraper-types/emirates.js"

export const meta: ScraperMetadata = {
  name: "emirates",
  blockUrls: [
    "googletagmanager.com", "google-analytics.com", "doubleclick.net",
    "facebook.com", "twitter.com", "linkedin.com", "optimizely.com"
  ]
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  // TODO: Research the correct Emirates Skywards API
  // Emirates uses Skywards miles for award redemptions
  
  // Placeholder URL structure - needs research
  const url = `https://www.emirates.com/english/skywards/spend-miles/flights/?origin=${query.origin}&destination=${query.destination}&departure=${query.departureDate}&passengers=1&class=all`
  
  arkalis.goto(url)
  
  // TODO: Research the actual API endpoint they use for award searches
  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "*/flight-search*", onlyStatusCode: 200, othersThrow: true },
    "no_availability": { type: "html", html: "No award availability" },
    "route_not_available": { type: "html", html: "route not available" },
    "login_required": { type: "html", html: "Please sign in to Emirates Skywards" },
  })
  
  if (waitForResult.name !== "success") {
    return arkalis.warn(waitForResult.name)
  }
  
  const response = JSON.parse(waitForResult.response!.body) as EmiratesResponse
  
  arkalis.log("parsing results")
  const results = standardizeResults(response, query)
  return results
}

const standardizeResults = (raw: EmiratesResponse, query: any): FlightWithFares[] => {
  const results: FlightWithFares[] = []
  
  // TODO: Implement parsing logic once Emirates API structure is known
  // Emirates has excellent First and Business class products (A380 suites, etc.)
  // Will need to capture their premium cabin offerings properly
  
  return results
}