#!/usr/bin/env tsx
/**
 * Roame.travel Award Flight Scraper
 * 
 * Uses Roame's GraphQL API to search award availability across ALL mileage programs
 * in a single query. Replaces the need for individual airline scrapers.
 * 
 * Requires: ~/.openclaw/credentials/roame.json with session cookie
 * 
 * Usage: npx tsx roame-scraper.ts --from LAX --to DXB --date 2026-04-28 [--class PREM|ECON]
 */

import fs from "fs"
import path from "path"

const CREDENTIALS_PATH = path.join(process.env.HOME!, ".openclaw/credentials/roame.json")
const GRAPHQL_URL = "https://roame.travel/api/graphql"

interface RoameFare {
  arrivalDatetime: string
  availableSeats: number | null
  departureDate: string
  operatingAirlines: string[]
  flightsDepartureDatetimes: string[]
  flightsArrivalDatetimes: string[]
  fareClass: string
  flightNumberOrder: string[]
  durationMinutes: number
  equipmentTypes: string[]
  allAirports: string[]
  numStops: number
  mileageProgram: string
  percentPremiumInt: number
  cabinClasses: string[]
  originIata: string
  destinationIata: string
  departureDateStr: string
  awardPoints: number
  surcharge: number
  roameScore: number
}

async function graphql(query: string, variables: Record<string, any>): Promise<any> {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"))
  
  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `session=${creds.session}; csrfSecret=${creds.csrfSecret}`,
    },
    body: JSON.stringify({ query, variables }),
  })
  
  return resp.json()
}

async function initiateSearch(origin: string, destination: string, date: string, searchClass: string): Promise<string> {
  const result = await graphql(
    `mutation initiateFlightSearchMutation($flightSearchInput: FlightSearchInput!) {
      initiateFlightSearch(flightSearchInput: $flightSearchInput) { jobUUID }
    }`,
    {
      flightSearchInput: {
        origin,
        destination,
        departureDate: date,
        pax: 1,
        searchClass,
        mileagePrograms: ["ALL"],
        preSearch: false,
        daysAround: 0,
        tripLength: 0,
      }
    }
  )
  
  if (result.errors) throw new Error(`Search failed: ${JSON.stringify(result.errors)}`)
  return result.data.initiateFlightSearch.jobUUID
}

async function pollResults(jobUUID: string, maxWaitMs: number = 60000): Promise<{ fares: RoameFare[], percentCompleted: number }> {
  const fareFragment = `
    arrivalDatetime availableSeats departureDate operatingAirlines
    flightsDepartureDatetimes flightsArrivalDatetimes fareClass
    flightNumberOrder durationMinutes equipmentTypes allAirports
    numStops mileageProgram percentPremiumInt cabinClasses
    originIata destinationIata departureDateStr awardPoints
    surcharge roameScore
  `
  
  const start = Date.now()
  let lastPct = 0
  let lastFareCount = 0
  let staleCount = 0
  
  while (Date.now() - start < maxWaitMs) {
    const result = await graphql(
      `query pingSearchResultsQuery($jobUUID: String!) {
        pingSearchResults(jobUUID: $jobUUID) {
          percentCompleted
          fares { ${fareFragment} }
        }
      }`,
      { jobUUID }
    )
    
    if (result.errors) throw new Error(`Poll failed: ${JSON.stringify(result.errors)}`)
    
    const { percentCompleted, fares } = result.data.pingSearchResults
    process.stdout.write(`\r  Progress: ${percentCompleted}% | ${fares.length} fares`)
    
    if (percentCompleted >= 100) {
      console.log(" ✅")
      return { fares, percentCompleted }
    }
    
    // Check if we're stale (no new fares for 3 polls)
    if (fares.length === lastFareCount && percentCompleted === lastPct) {
      staleCount++
      if (staleCount >= 3) {
        console.log(` (stalled at ${percentCompleted}%)`)
        return { fares, percentCompleted }
      }
    } else {
      staleCount = 0
    }
    
    lastPct = percentCompleted
    lastFareCount = fares.length
    await new Promise(r => setTimeout(r, 3000))
  }
  
  console.log(" (timeout)")
  return { fares: [], percentCompleted: lastPct }
}

async function main() {
  const args = process.argv.slice(2)
  const getArg = (flag: string, def: string) => {
    const idx = args.indexOf(flag)
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1]! : def
  }
  
  const origin = getArg("--from", "LAX")
  const destination = getArg("--to", "DXB")
  const date = getArg("--date", "2026-04-28")
  const searchClass = getArg("--class", "PREM")
  
  console.log(`\n🔍 Roame Award Search: ${origin} → ${destination} on ${date} (${searchClass})`)
  console.log(`   Searching ALL mileage programs...\n`)
  
  // Initiate search
  const jobUUID = await initiateSearch(origin, destination, date, searchClass)
  console.log(`  Job started: ${jobUUID}`)
  
  // Poll for results
  const { fares, percentCompleted } = await pollResults(jobUUID)
  
  // Group by program and display
  const byProgram = new Map<string, RoameFare[]>()
  for (const fare of fares) {
    const existing = byProgram.get(fare.mileageProgram) || []
    existing.push(fare)
    byProgram.set(fare.mileageProgram, existing)
  }
  
  console.log(`\n${"═".repeat(100)}`)
  console.log(`🏆 ${fares.length} fares found across ${byProgram.size} programs (${percentCompleted}% complete)`)
  console.log(`${"═".repeat(100)}\n`)
  
  // Sort programs by best fare
  const sortedPrograms = [...byProgram.entries()].sort((a, b) => {
    const bestA = Math.min(...a[1].map(f => f.awardPoints))
    const bestB = Math.min(...b[1].map(f => f.awardPoints))
    return bestA - bestB
  })
  
  for (const [program, programFares] of sortedPrograms) {
    console.log(`\n${program} (${programFares.length} fares):`)
    console.log(`${"─".repeat(100)}`)
    
    const sorted = programFares.sort((a, b) => a.awardPoints - b.awardPoints)
    for (const fare of sorted.slice(0, 5)) {
      const cabins = fare.cabinClasses.join("/")
      const route = fare.allAirports.join("→")
      const airlines = fare.operatingAirlines.join("/")
      const flights = fare.flightNumberOrder.join(" / ")
      const duration = `${Math.floor(fare.durationMinutes / 60)}h${fare.durationMinutes % 60}m`
      
      console.log(
        `  ${fare.awardPoints.toLocaleString().padStart(8)} pts + $${fare.surcharge.toFixed(0).padStart(5)}` +
        `  ${cabins.padEnd(25)} ${route.padEnd(30)} ${duration.padEnd(7)} ${airlines.padEnd(10)} ${flights}`
      )
    }
    if (sorted.length > 5) console.log(`  ... and ${sorted.length - 5} more`)
  }
  
  // Save results
  const output = {
    search: { origin, destination, date, searchClass, percentCompleted },
    programs: Object.fromEntries(sortedPrograms),
    totalFares: fares.length,
    timestamp: new Date().toISOString(),
  }
  
  fs.writeFileSync("roame-results.json", JSON.stringify(output, null, 2))
  console.log(`\n💾 Results saved to roame-results.json`)
}

main().catch(console.error)
