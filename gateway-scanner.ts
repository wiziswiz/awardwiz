#!/usr/bin/env tsx
/**
 * Gateway Positioning Flight Scanner
 * 
 * Searches award flights from ALL US gateway airports to a destination,
 * then adds the cost of a cheap positioning flight from your home airport.
 * Finds the cheapest total cost to fly business/first class anywhere.
 * 
 * Usage: npx tsx gateway-scanner.ts --home LAX --dest DXB --date 2026-04-28 [--cabin business]
 */

import { runArkalis } from "./arkalis/arkalis.js"
import { runScraper as runAA, meta as aaMeta } from "./awardwiz-scrapers/scrapers/aa.js"
import { FlightWithFares } from "./awardwiz-scrapers/awardwiz-types.js"

// US Gateway airports with good international connectivity
const US_GATEWAYS = [
  "JFK", "EWR", "IAD", "ORD", "SFO", "MIA", "DFW", "SEA",
  "BOS", "ATL", "IAH", "LAX", "PHX", "DEN", "DTW"
]

// Nearby country gateways (often cheaper award pricing)
const INTL_GATEWAYS = ["YYZ", "YVR", "MEX"]

// Estimated positioning flight costs (USD, economy)
// These are rough estimates — could be replaced with Google Flights API
const POSITIONING_COSTS: Record<string, Record<string, number>> = {
  LAX: {
    JFK: 120, EWR: 120, IAD: 110, ORD: 80, SFO: 60, MIA: 100, DFW: 70,
    SEA: 70, BOS: 130, ATL: 90, IAH: 70, LAX: 0, PHX: 50, DEN: 60, DTW: 90,
    YYZ: 150, YVR: 100, MEX: 120
  },
  SFO: {
    JFK: 130, EWR: 130, IAD: 120, ORD: 90, SFO: 0, MIA: 110, DFW: 80,
    SEA: 60, BOS: 140, ATL: 100, IAH: 80, LAX: 60, PHX: 60, DEN: 70, DTW: 100,
    YYZ: 160, YVR: 80, MEX: 130
  },
}

interface GatewayResult {
  gateway: string
  flight: FlightWithFares
  fare: { cabin: string; miles: number; cash: number; scraper: string }
  positioningCost: number
  totalCash: number
  totalMiles: number
  savings?: { vsDirect: number; percentage: number }
}

async function searchGateway(
  gateway: string, 
  destination: string, 
  date: string
): Promise<FlightWithFares[]> {
  try {
    const results = await runArkalis(
      async (arkalis) => {
        return await runAA(arkalis, {
          origin: gateway,
          destination,
          departureDate: date,
        })
      },
      {
        maxAttempts: 2,
        useProxy: false,
        showRequests: false,
        browserDebug: false,
      },
      {
        ...aaMeta,
        defaultTimeoutMs: 60000,
      },
      `gateway-${gateway}`
    )
    return (results as any)?.result || []
  } catch (e: any) {
    console.error(`  ❌ ${gateway}: ${e.message?.slice(0, 60)}`)
    return []
  }
}

async function main() {
  const args = process.argv.slice(2)
  const getArg = (flag: string, def: string) => {
    const idx = args.indexOf(flag)
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1]! : def
  }
  const homeAirport = getArg("--home", "LAX")
  const destination = getArg("--dest", "DXB")
  const date = getArg("--date", "2026-04-28")
  const targetCabin = getArg("--cabin", "all")
  const includeIntl = args.includes("--intl")

  const gateways = [...US_GATEWAYS, ...(includeIntl ? INTL_GATEWAYS : [])]
  const positioningCosts = POSITIONING_COSTS[homeAirport] || POSITIONING_COSTS["LAX"]!

  console.log(`\n🔍 Gateway Positioning Flight Scanner`)
  console.log(`   Home: ${homeAirport} → Destination: ${destination}`)
  console.log(`   Date: ${date} | Target cabin: ${targetCabin}`)
  console.log(`   Scanning ${gateways.length} gateway airports...\n`)

  const allResults: GatewayResult[] = []
  let directResults: GatewayResult[] = []

  // Search each gateway (sequentially to avoid rate limiting)
  for (const gateway of gateways) {
    const posCost = positioningCosts[gateway] ?? 150
    process.stdout.write(`  ✈️  ${gateway}${gateway === homeAirport ? " (home)" : ` (+$${posCost} positioning)`}... `)
    
    const flights = await searchGateway(gateway, destination, date)
    
    if (flights.length === 0) {
      console.log("no flights")
      continue
    }

    let flightCount = 0
    for (const flight of flights) {
      for (const fare of flight.fares) {
        if (targetCabin !== "all" && fare.cabin !== targetCabin) continue
        
        const result: GatewayResult = {
          gateway,
          flight,
          fare,
          positioningCost: gateway === homeAirport ? 0 : posCost,
          totalCash: fare.cash + (gateway === homeAirport ? 0 : posCost),
          totalMiles: fare.miles,
        }
        
        allResults.push(result)
        if (gateway === homeAirport) directResults.push(result)
        flightCount++
      }
    }
    console.log(`${flightCount} fares`)
  }

  // Calculate savings vs direct
  if (directResults.length > 0) {
    const cheapestDirectByClass: Record<string, number> = {}
    for (const dr of directResults) {
      const existing = cheapestDirectByClass[dr.fare.cabin]
      if (!existing || dr.totalMiles < existing)
        cheapestDirectByClass[dr.fare.cabin] = dr.totalMiles
    }
    
    for (const result of allResults) {
      const directMiles = cheapestDirectByClass[result.fare.cabin]
      if (directMiles && result.totalMiles < directMiles) {
        result.savings = {
          vsDirect: directMiles - result.totalMiles,
          percentage: Math.round((1 - result.totalMiles / directMiles) * 100)
        }
      }
    }
  }

  // Sort by total miles (within each cabin class)
  const cabins = [...new Set(allResults.map(r => r.fare.cabin))]
  
  console.log(`\n${"═".repeat(90)}`)
  console.log(`🏆 RESULTS: Best deals from each gateway to ${destination}`)
  console.log(`${"═".repeat(90)}`)

  for (const cabin of ["first", "business", "economy"]) {
    const cabinResults = allResults
      .filter(r => r.fare.cabin === cabin)
      .sort((a, b) => a.totalMiles - b.totalMiles)
    
    if (cabinResults.length === 0) continue

    console.log(`\n${cabin.toUpperCase()} CLASS:`)
    console.log(`${"─".repeat(90)}`)
    console.log(`${"Gateway".padEnd(8)} ${"Miles".padStart(8)} ${"Taxes".padStart(7)} ${"Pos.Flt".padStart(8)} ${"Total$".padStart(8)} ${"Savings".padStart(12)}  Route`)
    console.log(`${"─".repeat(90)}`)

    // Show best from each gateway (deduplicated)
    const seenGateways = new Set<string>()
    for (const r of cabinResults) {
      if (seenGateways.has(r.gateway)) continue
      seenGateways.add(r.gateway)

      const savings = r.savings 
        ? `${r.savings.vsDirect.toLocaleString()} mi (${r.savings.percentage}%)`.padStart(12)
        : "—".padStart(12)
      
      const route = `${r.flight.flightNo} (${r.flight.departureDateTime.slice(11, 16)}→${r.flight.arrivalDateTime.slice(11, 16)})`
      
      console.log(
        `${r.gateway.padEnd(8)} ` +
        `${r.totalMiles.toLocaleString().padStart(8)} ` +
        `$${r.fare.cash.toFixed(0).padStart(5)} ` +
        `${r.positioningCost > 0 ? "+$" + r.positioningCost : "  —  ".padStart(5)}`.padStart(8) + ` ` +
        `$${r.totalCash.toFixed(0).padStart(5)} ` +
        `${savings}  ` +
        `${route}`
      )
    }
  }

  // Top recommendation
  const bestBusiness = allResults
    .filter(r => r.fare.cabin === "business")
    .sort((a, b) => a.totalMiles - b.totalMiles)[0]
  
  const bestEconomy = allResults
    .filter(r => r.fare.cabin === "economy")
    .sort((a, b) => a.totalMiles - b.totalMiles)[0]

  console.log(`\n${"═".repeat(90)}`)
  console.log(`💡 TOP RECOMMENDATIONS:`)
  if (bestBusiness) {
    console.log(`   Business: Fly ${homeAirport}→${bestBusiness.gateway}${bestBusiness.gateway !== homeAirport ? ` ($${bestBusiness.positioningCost})` : ""} then ${bestBusiness.gateway}→${destination}`)
    console.log(`             ${bestBusiness.totalMiles.toLocaleString()} miles + $${bestBusiness.totalCash.toFixed(0)} via ${bestBusiness.flight.flightNo}`)
    if (bestBusiness.savings) console.log(`             Saves ${bestBusiness.savings.vsDirect.toLocaleString()} miles vs direct!`)
  }
  if (bestEconomy) {
    console.log(`   Economy:  ${bestEconomy.gateway}→${destination}: ${bestEconomy.totalMiles.toLocaleString()} miles + $${bestEconomy.totalCash.toFixed(0)}`)
  }
  console.log(`${"═".repeat(90)}\n`)

  // Save results
  const output = {
    search: { home: homeAirport, destination, date, targetCabin, gateways: gateways.length },
    results: allResults.map(r => ({
      gateway: r.gateway,
      cabin: r.fare.cabin,
      miles: r.totalMiles,
      taxes: r.fare.cash,
      positioningCost: r.positioningCost,
      totalCash: r.totalCash,
      flightNo: r.flight.flightNo,
      departure: r.flight.departureDateTime,
      arrival: r.flight.arrivalDateTime,
      savings: r.savings,
    })),
    timestamp: new Date().toISOString(),
  }
  
  const fs = await import("fs")
  fs.writeFileSync("gateway-results.json", JSON.stringify(output, null, 2))
  console.log(`💾 Full results saved to gateway-results.json`)
}

main().catch(console.error)
