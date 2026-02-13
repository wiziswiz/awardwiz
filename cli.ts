#!/usr/bin/env node

import { program } from 'commander'
import fs from 'fs/promises'
import path from 'path'
import { runArkalis } from './arkalis/arkalis.js'
import { AwardWizQuery, FlightWithFares } from './awardwiz-scrapers/awardwiz-types.js'
import { 
  fetchAwardWalletBalances, 
  getBalancesByScraper, 
  createSampleCredentialsFile 
} from './awardwiz-scrapers/integrations/awardwallet.js'
import { 
  calculateTransferOptions, 
  getTransferSummary, 
  TransferCalculation 
} from './awardwiz-scrapers/integrations/transfer-partners.js'

// Import available scrapers
import { runScraper as unitedScraper, meta as unitedMeta } from './awardwiz-scrapers/scrapers/united.js'
import { runScraper as alaskaScraper, meta as alaskaMeta } from './awardwiz-scrapers/scrapers/alaska.js'
import { runScraper as aeroplanScraper, meta as aeroplanMeta } from './awardwiz-scrapers/scrapers/aeroplan.js'
import { runScraper as airfranceScraper, meta as airfranceMeta } from './awardwiz-scrapers/scrapers/airfrance.js'
import { runScraper as britishairwaysScraper, meta as britishairwaysMeta } from './awardwiz-scrapers/scrapers/britishairways.js'
import { runScraper as qatarairwaysScraper, meta as qatarairwaysMeta } from './awardwiz-scrapers/scrapers/qatarairways.js'
import { runScraper as emiratesScraper, meta as emiratesMeta } from './awardwiz-scrapers/scrapers/emirates.js'
// TODO: Add other scrapers as they're implemented
// import { runScraper as aaScraper, meta as aaMeta } from './awardwiz-scrapers/scrapers/aa.js'
// import { runScraper as deltaScraper, meta as deltaMeta } from './awardwiz-scrapers/scrapers/delta.js'

interface ScraperModule {
  runScraper: (arkalis: any, query: AwardWizQuery) => Promise<FlightWithFares[]>
  meta: any
}

interface SearchResult {
  scraper: string
  status: 'success' | 'error' | 'timeout'
  flights: FlightWithFares[]
  error?: string
  duration: number
  stats: {
    requests: number
    cacheHits: number
    bytes: number
  }
}

interface SearchSummary {
  query: AwardWizQuery
  timestamp: string
  totalFlights: number
  scraperResults: SearchResult[]
  userBalances?: any
  transferCalculations?: TransferCalculation[]
  transferSummary?: any
}

// Available scrapers registry
const AVAILABLE_SCRAPERS: Record<string, ScraperModule> = {
  'united': { runScraper: unitedScraper, meta: unitedMeta },
  'alaska': { runScraper: alaskaScraper, meta: alaskaMeta },
  'aeroplan': { runScraper: aeroplanScraper, meta: aeroplanMeta },
  'airfrance': { runScraper: airfranceScraper, meta: airfranceMeta },
  'britishairways': { runScraper: britishairwaysScraper, meta: britishairwaysMeta },
  'qatarairways': { runScraper: qatarairwaysScraper, meta: qatarairwaysMeta },
  'emirates': { runScraper: emiratesScraper, meta: emiratesMeta },
  // TODO: Add more as implemented
}

program
  .name('awardwiz')
  .description('AwardWiz 2.0 - Award flight search across multiple airlines')
  .version('2.0.0')

program
  .command('search')
  .description('Search for award flights')
  .requiredOption('-f, --from <airport>', 'Origin airport code (e.g., LAX)')
  .requiredOption('-t, --to <airport>', 'Destination airport code (e.g., DXB)')
  .requiredOption('-d, --date <date>', 'Departure date (YYYY-MM-DD)')
  .option('-p, --programs <programs>', 'Comma-separated list of programs to search (default: all)')
  .option('-b, --balances', 'Include user balances and transfer calculations')
  .option('-o, --output <file>', 'Output file for results (default: results.json)')
  .option('--timeout <seconds>', 'Timeout per scraper in seconds', '45')
  .option('--no-proxy', 'Disable proxy usage')
  .option('--verbose', 'Show detailed request logs')
  .action(async (options) => {
    await runSearch(options)
  })

program
  .command('balances')
  .description('Show user balances and transfer options')
  .option('-o, --output <file>', 'Output file for results (default: balances.json)')
  .action(async (options) => {
    await showBalances(options)
  })

program
  .command('setup')
  .description('Set up AwardWallet credentials')
  .action(async () => {
    await createSampleCredentialsFile()
  })

program
  .command('list')
  .description('List available scrapers')
  .action(() => {
    console.log('Available scrapers:')
    for (const [name, module] of Object.entries(AVAILABLE_SCRAPERS)) {
      console.log(`  ${name}: ${module.meta.name}`)
    }
  })

async function runSearch(options: any) {
  const query: AwardWizQuery = {
    origin: options.from.toUpperCase(),
    destination: options.to.toUpperCase(),
    departureDate: options.date
  }
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.departureDate)) {
    console.error('❌ Date must be in YYYY-MM-DD format')
    process.exit(1)
  }
  
  // Determine which scrapers to run
  const requestedPrograms = options.programs ? options.programs.split(',').map((p: string) => p.trim()) : Object.keys(AVAILABLE_SCRAPERS)
  const scrapersToRun = requestedPrograms.filter((program: string) => {
    if (!AVAILABLE_SCRAPERS[program]) {
      console.warn(`⚠️ Unknown program: ${program}`)
      return false
    }
    return true
  })
  
  if (scrapersToRun.length === 0) {
    console.error('❌ No valid scrapers to run')
    process.exit(1)
  }
  
  console.log(`🔍 Searching flights: ${query.origin} → ${query.destination} on ${query.departureDate}`)
  console.log(`📋 Running scrapers: ${scrapersToRun.join(', ')}`)
  
  const results: SearchResult[] = []
  const startTime = Date.now()
  
  // Run scrapers in parallel with Promise.allSettled to handle failures gracefully
  const scraperPromises = scrapersToRun.map(async (scraperName: string): Promise<SearchResult> => {
    const scraper = AVAILABLE_SCRAPERS[scraperName]!
    const scraperStart = Date.now()
    
    console.log(`⚡ Starting ${scraperName}...`)
    
    try {
      const result = await runArkalis(
        async (arkalis) => {
          return await scraper.runScraper(arkalis, query)
        },
        {
          maxAttempts: 1,
          useProxy: !options.noProxy,
          showRequests: options.verbose,
          browserDebug: false
        },
        {
          ...scraper.meta,
          defaultTimeoutMs: parseInt(options.timeout) * 1000
        },
        `search-${scraperName}`
      )
      
      const duration = Date.now() - scraperStart
      const flights = result.result || []
      
      console.log(`✅ ${scraperName}: ${flights.length} flights found (${duration}ms)`)
      
      return {
        scraper: scraperName,
        status: 'success' as const,
        flights,
        duration,
        stats: {
          requests: 0, // TODO: Get from arkalis stats
          cacheHits: 0,
          bytes: 0
        }
      }
      
    } catch (error) {
      const duration = Date.now() - scraperStart
      console.log(`❌ ${scraperName}: ${(error as Error).message} (${duration}ms)`)
      
      return {
        scraper: scraperName,
        status: 'error' as const,
        flights: [],
        error: (error as Error).message,
        duration,
        stats: { requests: 0, cacheHits: 0, bytes: 0 }
      }
    }
  })
  
  const scraperResults = await Promise.allSettled(scraperPromises)
  
  // Process results
  for (const result of scraperResults) {
    if (result.status === 'fulfilled') {
      results.push(result.value)
    } else {
      console.error(`❌ Scraper failed: ${result.reason}`)
    }
  }
  
  const totalFlights = results.reduce((sum, result) => sum + result.flights.length, 0)
  const totalDuration = Date.now() - startTime
  
  console.log(`\n📊 Search complete: ${totalFlights} flights found in ${totalDuration}ms`)
  
  // Build final summary
  const summary: SearchSummary = {
    query,
    timestamp: new Date().toISOString(),
    totalFlights,
    scraperResults: results
  }
  
  // Include balances if requested
  if (options.balances) {
    try {
      console.log('💳 Fetching user balances...')
      const balancesResponse = await fetchAwardWalletBalances()
      if (balancesResponse.success) {
        summary.userBalances = balancesResponse.balances
        summary.transferCalculations = calculateTransferOptions(balancesResponse.balances)
        summary.transferSummary = getTransferSummary(summary.transferCalculations)
        
        console.log(`💰 Found balances in ${summary.transferCalculations.filter(c => c.transferableBalance > 0).length} programs`)
      }
    } catch (error) {
      console.warn(`⚠️ Could not fetch balances: ${(error as Error).message}`)
    }
  }
  
  // Output results
  const outputFile = options.output || 'results.json'
  await fs.writeFile(outputFile, JSON.stringify(summary, null, 2))
  console.log(`💾 Results saved to ${outputFile}`)
  
  // Show summary
  console.log('\n🎯 Summary:')
  for (const result of results) {
    if (result.status === 'success' && result.flights.length > 0) {
      console.log(`\n${result.scraper.toUpperCase()}:`)
      for (const flight of result.flights.slice(0, 3)) { // Show first 3 flights
        console.log(`  ${flight.flightNo}: ${flight.departureDateTime} → ${flight.arrivalDateTime}`)
        for (const fare of flight.fares) {
          console.log(`    ${fare.cabin}: ${fare.miles} miles + $${fare.cash}`)
        }
      }
      if (result.flights.length > 3) {
        console.log(`    ... and ${result.flights.length - 3} more flights`)
      }
    }
  }
}

async function showBalances(options: any) {
  console.log('💳 Fetching AwardWallet balances...')
  
  try {
    const response = await fetchAwardWalletBalances()
    
    if (!response.success) {
      console.error(`❌ Failed to fetch balances: ${response.error}`)
      process.exit(1)
    }
    
    const transferCalculations = calculateTransferOptions(response.balances)
    const summary = getTransferSummary(transferCalculations)
    
    console.log(`\n💰 Balance Summary:`)
    console.log(`   Direct miles: ${summary.totalDirectMiles.toLocaleString()}`)
    console.log(`   With transfers: ${summary.totalTransferableMiles.toLocaleString()}`)
    console.log(`   Active programs: ${summary.programCount}`)
    
    console.log(`\n📋 Top Programs:`)
    for (const program of summary.topPrograms) {
      console.log(`   ${program.name}: ${program.balance.toLocaleString()} miles`)
    }
    
    console.log(`\n🔄 Transfer Options:`)
    for (const calc of transferCalculations.slice(0, 10)) {
      if (calc.transferOptions.length > 0) {
        console.log(`\n${calc.programName}:`)
        console.log(`   Direct: ${calc.directBalance.toLocaleString()}`)
        console.log(`   With transfers: ${calc.transferableBalance.toLocaleString()}`)
        for (const transfer of calc.transferOptions.slice(0, 3)) {
          console.log(`   → ${transfer.resultingMiles.toLocaleString()} from ${transfer.fromProgram} (${transfer.transferTime})`)
        }
      }
    }
    
    // Save results
    const outputFile = options.output || 'balances.json'
    const output = {
      timestamp: new Date().toISOString(),
      balances: response.balances,
      transferCalculations,
      summary
    }
    
    await fs.writeFile(outputFile, JSON.stringify(output, null, 2))
    console.log(`\n💾 Detailed results saved to ${outputFile}`)
    
  } catch (error) {
    console.error(`❌ Error: ${(error as Error).message}`)
    process.exit(1)
  }
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse()
}

export { program }