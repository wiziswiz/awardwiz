import { AwardWizQuery, AwardWizScraper, FlightWithFares } from "../awardwiz-types.js"
import type { Trip, UnitedResponse } from "../scraper-types/united.js"
import { ScraperMetadata } from "../../arkalis/arkalis.js"

export const meta: ScraperMetadata = {
  name: "united",
  blockUrls: ["liveperson.net", "tags.tiqcdn.com"],
}

// TODO: United changed their auth flow. The anonymous-token returns a hash but FetchFlights
// rejects it with 403 "AuthenticationSkipped". Need to reverse-engineer their current
// X-Authorization-api flow. For now, AA scraper covers many United codeshare routes.
export const runScraper: AwardWizScraper = async (arkalis, query) => {
  const url = `https://www.united.com/en/us/fsr/choose-flights?f=${query.origin}&t=${query.destination}&d=${query.departureDate}&tt=1&at=1&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&tqp=A`
  arkalis.goto(url)

  arkalis.log("waiting for page load")
  const pageResult = await arkalis.waitFor({
    "loaded": { type: "url", url: "https://www.united.com/api/auth/anonymous-token" },
    "anti-botting": { type: "html", html: "united.com was unable to complete" },
  })
  if (pageResult.name === "anti-botting")
    throw new Error("anti-botting")

  // Get auth token
  const tokenResp = await arkalis.evaluate<string>(`
    fetch("/api/auth/anonymous-token", { credentials: "include" })
      .then(r => r.json())
      .then(d => d?.data?.token?.hash || "")
  `)
  if (!tokenResp)
    throw new Error("Failed to get auth token")
  arkalis.log(`Got token: ${tokenResp.slice(0, 20)}...`)

  // Fire FetchFlights  
  const fetchPayload = JSON.stringify({
    Columns: 7, Filters: { Stops: [] }, MaxTrips: 100, PageIndex: 1, PageSize: 25,
    SortType: "bestmatches",
    Trips: [{ DepartDate: query.departureDate, Destination: query.destination, Origin: query.origin,
      NonStopOnly: false, SearchFiltersIn: { FareFamily: "ECONOMY" }, SearchRadiusIn: 0, SearchRadiusOut: 0 }],
    SearchTypeSelection: 1, AwardTravel: true, CalendarOnly: false, CalendarLengthOfStay: 0,
  })

  const responseText = await arkalis.evaluate<string>(`
    fetch("/api/flight/FetchFlights", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json",
        "X-Authorization-api": "bearer " + ${JSON.stringify(tokenResp)} },
      body: ${JSON.stringify(fetchPayload)}
    }).then(r => r.text())
  `)
  if (!responseText)
    throw new Error("Empty response from FetchFlights")
  
  const fetchFlights = JSON.parse(responseText) as UnitedResponse
  if (!fetchFlights.data?.Trips?.length)
    return []

  arkalis.log("parsing results")
  const flightsWithFares: FlightWithFares[] = []
  const flights = standardizeResults(query, fetchFlights.data!.Trips[0]!)
  flightsWithFares.push(...flights)
  return flightsWithFares
}

const standardizeResults = (query: AwardWizQuery, unitedTrip: Trip) => {
  const results: FlightWithFares[] = []
  for (const flight of unitedTrip.Flights) {
    const result: FlightWithFares = {
      departureDateTime: `${flight.DepartDateTime}:00`,
      arrivalDateTime: `${flight.DestinationDateTime}:00`,
      origin: flight.Origin,
      destination: flight.Destination,
      flightNo: `${flight.MarketingCarrier} ${flight.FlightNumber}`,
      duration: flight.TravelMinutes,
      aircraft: flight.EquipmentDisclosures.EquipmentDescription,
      fares: [],
      amenities: { hasPods: undefined, hasWiFi: undefined }
    }

    if (flight.Origin !== (unitedTrip.RequestedOrigin || unitedTrip.Origin))
      continue
    if (flight.Destination !== (unitedTrip.RequestedDestination || unitedTrip.Destination))
      continue
    if (result.departureDateTime.substring(0, 10) !== query.departureDate.substring(0, 10))
      continue

    // Include connecting flights
    if (flight.Connections.length > 0) {
      result.flightNo = `${flight.MarketingCarrier} ${flight.FlightNumber}` + 
        flight.Connections.map((c: any) => ` / ${c.MarketingCarrier || flight.MarketingCarrier} ${c.FlightNumber || ""}`).join("")
    }

    for (const product of flight.Products) {
      if (product.Prices.length === 0) continue
      const miles = product.Prices[0]!.Amount
      const cash = product.Prices.length >= 2 ? product.Prices[1]!.Amount : 0
      const currencyOfCash = product.Prices.length >= 2 ? product.Prices[1]!.Currency : ""
      const bookingClass = product.BookingCode

      const cabin = { "United First": "business", "United Economy": "economy", "United Business": "business", 
        Economy: "economy", Business: "business", First: "first", 
        "United Polaris business": "business", "United Premium Plus": "economy" }[product.Description!]
      if (cabin === undefined)
        throw new Error(`Unknown cabin type: ${product.Description!}`)

      let existingFare = result.fares.find((fare) => fare.cabin === cabin)
      if (existingFare !== undefined) {
        if (miles < existingFare.miles)
          existingFare = { cabin, miles, cash, currencyOfCash, bookingClass, scraper: "united" }
      } else {
        result.fares.push({ cabin, miles, cash, currencyOfCash, bookingClass, scraper: "united" })
      }
    }

    results.push(result)
  }
  return results
}
