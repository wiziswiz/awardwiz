import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// AwardWallet API integration for fetching user balances

export interface AwardWalletCredentials {
  apiKey: string
  userId: string
}

export interface AwardWalletBalance {
  programId: string
  programName: string
  currency: string
  balance: number
  expirationDate?: string
  lastUpdated: string
  isActive: boolean
}

export interface AwardWalletResponse {
  success: boolean
  balances: AwardWalletBalance[]
  error?: string
}

// Mapping from AwardWallet program names to our scraper names
const PROGRAM_SCRAPER_MAPPING: Record<string, string> = {
  // United Airlines
  "United Airlines MileagePlus": "united",
  "United MileagePlus": "united",
  
  // American Airlines
  "American Airlines AAdvantage": "aa",
  "AA AAdvantage": "aa",
  
  // Delta
  "Delta Air Lines SkyMiles": "delta",
  "Delta SkyMiles": "delta",
  
  // Alaska Airlines
  "Alaska Airlines Mileage Plan": "alaska",
  "Alaska Mileage Plan": "alaska",
  
  // JetBlue
  "JetBlue Airways TrueBlue": "jetblue",
  "JetBlue TrueBlue": "jetblue",
  
  // Southwest
  "Southwest Airlines Rapid Rewards": "southwest",
  "Southwest Rapid Rewards": "southwest",
  
  // Air Canada Aeroplan
  "Air Canada Aeroplan": "aeroplan",
  "Aeroplan": "aeroplan",
  
  // Air France Flying Blue
  "Air France Flying Blue": "air-france",
  "Flying Blue": "air-france",
  
  // British Airways Executive Club
  "British Airways Executive Club": "british-airways",
  "British Airways Avios": "british-airways",
  
  // Qatar Airways Privilege Club
  "Qatar Airways Privilege Club": "qatar",
  "Qatar Privilege Club": "qatar",
  
  // Emirates Skywards
  "Emirates Skywards": "emirates",
  
  // Credit card programs (for transfer partner logic)
  "Chase Ultimate Rewards": "chase-ur",
  "American Express Membership Rewards": "amex-mr",
  "Capital One Venture": "capital-one",
  "Citi ThankYou Points": "citi-typ",
  "Bilt Rewards": "bilt"
}

/**
 * Load AwardWallet credentials from the OpenClaw credentials directory
 */
export async function loadAwardWalletCredentials(): Promise<AwardWalletCredentials> {
  const credentialsPath = path.join(process.env.HOME || '~', '.openclaw', 'credentials', 'awardwallet.json')
  
  try {
    const credentialsData = await fs.readFile(credentialsPath, 'utf-8')
    const credentials = JSON.parse(credentialsData) as AwardWalletCredentials
    
    if (!credentials.apiKey || !credentials.userId) {
      throw new Error('AwardWallet credentials must include apiKey and userId')
    }
    
    return credentials
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`AwardWallet credentials not found at ${credentialsPath}. Please create this file with your API key and user ID.`)
    }
    throw new Error(`Failed to load AwardWallet credentials: ${(error as Error).message}`)
  }
}

/**
 * Fetch balances from AwardWallet API
 */
export async function fetchAwardWalletBalances(credentials?: AwardWalletCredentials): Promise<AwardWalletResponse> {
  try {
    // Use provided credentials or load from file
    const creds = credentials || await loadAwardWalletCredentials()
    
    const apiUrl = `https://business.awardwallet.com/api/export/v1/connectedUser/${creds.userId}`
    
    console.log(`Fetching balances from AwardWallet for user ${creds.userId}...`)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Authentication': creds.apiKey,
        'User-Agent': 'AwardWiz/2.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`AwardWallet API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json() as any
    
    // Transform the response to our standardized format
    const balances: AwardWalletBalance[] = []
    
    // AwardWallet API structure may vary - this is based on typical structure
    if (data.accounts && Array.isArray(data.accounts)) {
      for (const account of data.accounts) {
        if (account.balance && account.balance > 0) {
          balances.push({
            programId: account.id || account.programId || '',
            programName: account.name || account.programName || '',
            currency: account.currency || 'miles',
            balance: account.balance,
            expirationDate: account.expirationDate,
            lastUpdated: account.lastUpdated || new Date().toISOString(),
            isActive: account.isActive !== false
          })
        }
      }
    }
    
    console.log(`Found ${balances.length} active balances from AwardWallet`)
    
    return {
      success: true,
      balances: balances.sort((a, b) => b.balance - a.balance) // Sort by balance descending
    }
    
  } catch (error) {
    console.error('AwardWallet API error:', error)
    return {
      success: false,
      balances: [],
      error: (error as Error).message
    }
  }
}

/**
 * Map AwardWallet program names to our scraper names
 */
export function mapProgramToScraper(programName: string): string | null {
  // Try exact match first
  const exactMatch = PROGRAM_SCRAPER_MAPPING[programName]
  if (exactMatch) {
    return exactMatch
  }
  
  // Try fuzzy matching
  const lowerName = programName.toLowerCase()
  for (const [awProgram, scraperName] of Object.entries(PROGRAM_SCRAPER_MAPPING)) {
    if (lowerName.includes(awProgram.toLowerCase()) || awProgram.toLowerCase().includes(lowerName)) {
      return scraperName
    }
  }
  
  return null
}

/**
 * Get balances organized by scraper name
 */
export async function getBalancesByScraper(credentials?: AwardWalletCredentials): Promise<Record<string, AwardWalletBalance[]>> {
  const response = await fetchAwardWalletBalances(credentials)
  
  if (!response.success) {
    throw new Error(`Failed to fetch AwardWallet balances: ${response.error}`)
  }
  
  const balancesByScraper: Record<string, AwardWalletBalance[]> = {}
  
  for (const balance of response.balances) {
    const scraperName = mapProgramToScraper(balance.programName)
    if (scraperName) {
      if (!balancesByScraper[scraperName]) {
        balancesByScraper[scraperName] = []
      }
      balancesByScraper[scraperName].push(balance)
    } else {
      console.log(`⚠️ Unknown program (no scraper mapping): ${balance.programName}`)
    }
  }
  
  return balancesByScraper
}

/**
 * Create a sample credentials file
 */
export async function createSampleCredentialsFile(): Promise<void> {
  const credentialsDir = path.join(process.env.HOME || '~', '.openclaw', 'credentials')
  const credentialsPath = path.join(credentialsDir, 'awardwallet.json')
  
  // Create directory if it doesn't exist
  await fs.mkdir(credentialsDir, { recursive: true })
  
  const sampleCredentials: AwardWalletCredentials = {
    apiKey: "your-awardwallet-api-key-here",
    userId: "422003"  // Example user ID from task description
  }
  
  await fs.writeFile(credentialsPath, JSON.stringify(sampleCredentials, null, 2))
  console.log(`Sample credentials file created at ${credentialsPath}`)
  console.log('Please edit this file with your actual AwardWallet API key and user ID.')
}