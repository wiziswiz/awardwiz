// Emirates Skywards API Response Types
// TODO: Update these types based on actual API response structure

export interface EmiratesResponse {
  // Placeholder structure - needs research
  searchResults?: EmiratesSearchResults
  meta?: {
    searchId: string
    totalResults: number
  }
  errors?: Array<{
    errorCode: string
    errorMessage: string
  }>
}

export interface EmiratesSearchResults {
  outbound: EmiratesFlight[]
  return?: EmiratesFlight[]
}

export interface EmiratesFlight {
  // TODO: Define based on actual Emirates API response
  flightId: string
  flightNumber: string
  departureDateTime: string
  arrivalDateTime: string
  origin: string
  destination: string
  duration: number
  aircraft: string
  segments: EmiratesSegment[]
  fareOptions: EmiratesFareOption[]
}

export interface EmiratesSegment {
  segmentId: string
  flightNumber: string
  departureTime: string
  arrivalTime: string
  departureAirport: string
  arrivalAirport: string
  aircraft: string
  duration: number
  operatingCarrier: string
}

export interface EmiratesFareOption {
  fareClass: string
  cabin: "economy" | "business" | "first"
  skywardsMiles: number
  taxes: number
  currency: string
  bookingClass: string
  availability: number
  seatType?: string // For Emirates' premium products like suites
}