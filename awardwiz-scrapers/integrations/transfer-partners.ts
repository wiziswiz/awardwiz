import { AwardWalletBalance } from './awardwallet.js'

// Transfer partner ratios and logic for credit card programs

export interface TransferPartner {
  partnerProgram: string
  ratio: number // How many credit card points needed per airline mile
  minimumTransfer: number
  maximumTransfer?: number
  transferTime: string // e.g. "instant", "1-2 days", "5-7 days"
  bonusPromotions?: TransferBonus[]
}

export interface TransferBonus {
  bonusPercentage: number // e.g. 25 for 25% bonus
  validUntil: string
  minimumTransfer?: number
  description: string
}

export interface TransferCalculation {
  scraperName: string
  programName: string
  directBalance: number
  transferableBalance: number // Total balance including transfers
  transferOptions: TransferOption[]
}

export interface TransferOption {
  fromProgram: string
  toProgram: string
  availablePoints: number
  transferRatio: number
  resultingMiles: number
  transferTime: string
  bonusActive?: boolean
  bonusDescription?: string
}

// Chase Ultimate Rewards transfer partners (1:1 unless noted)
const CHASE_UR_PARTNERS: TransferPartner[] = [
  {
    partnerProgram: "united",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "air-france", 
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "british-airways",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "singapore", // Future scraper
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "southwest",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  }
]

// American Express Membership Rewards transfer partners
const AMEX_MR_PARTNERS: TransferPartner[] = [
  {
    partnerProgram: "air-france",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "british-airways", 
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "delta",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "emirates",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "1-2 days"
  },
  {
    partnerProgram: "singapore", // Future scraper
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  }
]

// Capital One Venture/Venture X transfer partners
const CAPITAL_ONE_PARTNERS: TransferPartner[] = [
  {
    partnerProgram: "air-france",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "british-airways",
    ratio: 1,
    minimumTransfer: 1000, 
    transferTime: "instant"
  },
  {
    partnerProgram: "emirates",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "1-2 days"
  },
  {
    partnerProgram: "singapore", // Future scraper
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  }
]

// Citi ThankYou Points transfer partners
const CITI_TYP_PARTNERS: TransferPartner[] = [
  {
    partnerProgram: "air-france",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "1-2 days"
  },
  {
    partnerProgram: "emirates",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "1-2 days"
  },
  {
    partnerProgram: "singapore", // Future scraper
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "1-2 days"
  }
]

// Bilt Rewards transfer partners (1:1 on 1st of each month)
const BILT_PARTNERS: TransferPartner[] = [
  {
    partnerProgram: "united",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "alaska",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "aa", 
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "air-france",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "instant"
  },
  {
    partnerProgram: "emirates",
    ratio: 1,
    minimumTransfer: 1000,
    transferTime: "1-2 days"
  }
]

// Master mapping of credit card programs to their transfer partners
const TRANSFER_PROGRAMS: Record<string, TransferPartner[]> = {
  "chase-ur": CHASE_UR_PARTNERS,
  "amex-mr": AMEX_MR_PARTNERS,
  "capital-one": CAPITAL_ONE_PARTNERS,
  "citi-typ": CITI_TYP_PARTNERS,
  "bilt": BILT_PARTNERS
}

/**
 * Calculate transferable balances for each airline program
 */
export function calculateTransferOptions(balances: AwardWalletBalance[]): TransferCalculation[] {
  const calculations: TransferCalculation[] = []
  const balancesByProgram = new Map<string, number>()
  
  // First, organize balances by program scraper name
  for (const balance of balances) {
    const key = `${balance.programName.toLowerCase()}`
    balancesByProgram.set(key, (balancesByProgram.get(key) || 0) + balance.balance)
  }
  
  // Get all unique airline programs (both direct and transferable)
  const allPrograms = new Set<string>()
  
  // Add direct balance programs
  for (const balance of balances) {
    if (isAirlineProgram(balance.programName)) {
      allPrograms.add(getScraperName(balance.programName))
    }
  }
  
  // Add programs that can be transferred to
  for (const transferPartners of Object.values(TRANSFER_PROGRAMS)) {
    for (const partner of transferPartners) {
      allPrograms.add(partner.partnerProgram)
    }
  }
  
  // Calculate transferable balance for each airline program
  for (const program of allPrograms) {
    const directBalance = getDirectBalance(program, balances)
    const transferOptions = calculateTransfersToProgram(program, balances)
    const transferableBalance = transferOptions.reduce((sum, option) => sum + option.resultingMiles, directBalance)
    
    calculations.push({
      scraperName: program,
      programName: getProgramDisplayName(program),
      directBalance,
      transferableBalance,
      transferOptions
    })
  }
  
  // Sort by total transferable balance descending
  return calculations.sort((a, b) => b.transferableBalance - a.transferableBalance)
}

/**
 * Calculate all possible transfers TO a specific airline program
 */
function calculateTransfersToProgram(targetProgram: string, balances: AwardWalletBalance[]): TransferOption[] {
  const transfers: TransferOption[] = []
  
  for (const [creditProgram, partners] of Object.entries(TRANSFER_PROGRAMS)) {
    const creditBalance = getBalanceForProgram(creditProgram, balances)
    if (creditBalance <= 0) continue
    
    const partner = partners.find(p => p.partnerProgram === targetProgram)
    if (!partner) continue
    
    const maxTransferable = Math.floor(creditBalance / partner.ratio) * partner.ratio
    if (maxTransferable >= partner.minimumTransfer) {
      const resultingMiles = maxTransferable / partner.ratio
      
      transfers.push({
        fromProgram: creditProgram,
        toProgram: targetProgram,
        availablePoints: maxTransferable,
        transferRatio: partner.ratio,
        resultingMiles,
        transferTime: partner.transferTime
      })
    }
  }
  
  return transfers
}

/**
 * Get direct balance for a specific airline program
 */
function getDirectBalance(program: string, balances: AwardWalletBalance[]): number {
  return balances
    .filter(b => getScraperName(b.programName) === program)
    .reduce((sum, b) => sum + b.balance, 0)
}

/**
 * Get balance for a credit card program
 */
function getBalanceForProgram(program: string, balances: AwardWalletBalance[]): number {
  const programVariations = getCreditCardVariations(program)
  
  return balances
    .filter(b => programVariations.some(variation => 
      b.programName.toLowerCase().includes(variation.toLowerCase())))
    .reduce((sum, b) => sum + b.balance, 0)
}

/**
 * Check if a program is an airline program (vs credit card)
 */
function isAirlineProgram(programName: string): boolean {
  const airlineKeywords = [
    'airlines', 'airways', 'air', 'mileageplus', 'aadvantage', 'skymiles', 
    'trueblue', 'rapid rewards', 'aeroplan', 'flying blue', 'executive club',
    'avios', 'privilege club', 'skywards', 'mileage plan'
  ]
  
  const lowerName = programName.toLowerCase()
  return airlineKeywords.some(keyword => lowerName.includes(keyword))
}

/**
 * Get scraper name from program name
 */
function getScraperName(programName: string): string {
  const name = programName.toLowerCase()
  
  if (name.includes('united')) return 'united'
  if (name.includes('american') || name.includes('aadvantage')) return 'aa'
  if (name.includes('delta')) return 'delta'
  if (name.includes('alaska')) return 'alaska'
  if (name.includes('jetblue')) return 'jetblue'
  if (name.includes('southwest')) return 'southwest'
  if (name.includes('aeroplan') || name.includes('air canada')) return 'aeroplan'
  if (name.includes('flying blue') || name.includes('air france')) return 'air-france'
  if (name.includes('british') || name.includes('avios')) return 'british-airways'
  if (name.includes('qatar')) return 'qatar'
  if (name.includes('emirates')) return 'emirates'
  
  return 'unknown'
}

/**
 * Get display name for a program
 */
function getProgramDisplayName(scraperName: string): string {
  const displayNames: Record<string, string> = {
    'united': 'United MileagePlus',
    'aa': 'American AAdvantage',
    'delta': 'Delta SkyMiles',
    'alaska': 'Alaska Mileage Plan',
    'jetblue': 'JetBlue TrueBlue',
    'southwest': 'Southwest Rapid Rewards',
    'aeroplan': 'Air Canada Aeroplan',
    'air-france': 'Air France Flying Blue',
    'british-airways': 'British Airways Executive Club',
    'qatar': 'Qatar Airways Privilege Club',
    'emirates': 'Emirates Skywards'
  }
  
  return displayNames[scraperName] || scraperName
}

/**
 * Get variations of credit card program names
 */
function getCreditCardVariations(program: string): string[] {
  const variations: Record<string, string[]> = {
    'chase-ur': ['chase ultimate rewards', 'ultimate rewards', 'chase ur'],
    'amex-mr': ['american express membership rewards', 'membership rewards', 'amex mr', 'amex points'],
    'capital-one': ['capital one venture', 'capital one', 'venture miles'],
    'citi-typ': ['citi thankyou', 'thankyou points', 'citi typ', 'citi points'],
    'bilt': ['bilt rewards', 'bilt points']
  }
  
  return variations[program] || [program]
}

/**
 * Get summary of total accessible miles across all programs
 */
export function getTransferSummary(calculations: TransferCalculation[]): {
  totalDirectMiles: number
  totalTransferableMiles: number
  programCount: number
  topPrograms: Array<{name: string, balance: number}>
} {
  const totalDirectMiles = calculations.reduce((sum, calc) => sum + calc.directBalance, 0)
  const totalTransferableMiles = calculations.reduce((sum, calc) => sum + calc.transferableBalance, 0)
  
  const topPrograms = calculations
    .filter(calc => calc.transferableBalance > 0)
    .slice(0, 5)
    .map(calc => ({
      name: calc.programName,
      balance: calc.transferableBalance
    }))
  
  return {
    totalDirectMiles,
    totalTransferableMiles,
    programCount: calculations.filter(calc => calc.transferableBalance > 0).length,
    topPrograms
  }
}