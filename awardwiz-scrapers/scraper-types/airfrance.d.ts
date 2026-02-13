// Air France / Flying Blue API Response Types
// TODO: Update these types based on actual API response structure

export interface AirFranceResponse {
  // Placeholder structure - needs research
  data?: {
    flights?: AirFranceFlight[]
    pagination?: {
      hasMore: boolean
      total: number
    }
  }
  errors?: Array<{
    code: string
    message: string
  }>
}

export interface AirFranceFlight {
  // TODO: Define based on actual API response
  flightNumber: string
  departureTime: string
  arrivalTime: string
  origin: string
  destination: string
  duration: number
  aircraft?: string
  fares: AirFranceFare[]
}

export interface AirFranceFare {
  cabin: string
  milesRequired: number
  taxesAndFees: number
  currency: string
  bookingClass: string
  availability: number
}