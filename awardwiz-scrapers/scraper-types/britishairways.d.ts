// British Airways Executive Club / Avios API Response Types
// TODO: Update these types based on actual API response structure

export interface BritishAirwaysResponse {
  // Placeholder structure - needs research
  journeys?: BritishAirwaysJourney[]
  meta?: {
    totalResults: number
    currency: string
  }
  errors?: Array<{
    errorCode: string
    errorMessage: string
  }>
}

export interface BritishAirwaysJourney {
  // TODO: Define based on actual BA API response
  segments: BritishAirwaysSegment[]
  totalAvios: number
  totalTaxes: number
  currency: string
  bookingClass: string
}

export interface BritishAirwaysSegment {
  flightNumber: string
  departureDateTime: string
  arrivalDateTime: string
  departureAirport: string
  arrivalAirport: string
  duration: string
  aircraft: string
  operatingCarrier: string
  marketingCarrier: string
  cabin: string
  fareType: string
  avios: number
  taxes: number
}