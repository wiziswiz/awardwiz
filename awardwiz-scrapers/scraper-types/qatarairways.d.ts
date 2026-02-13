// Qatar Airways Privilege Club API Response Types
// TODO: Update these types based on actual API response structure

export interface QatarAirwaysResponse {
  // Placeholder structure - needs research
  flights?: QatarAirwaysFlight[]
  searchResults?: {
    outbound: QatarAirwaysJourney[]
    return?: QatarAirwaysJourney[]
  }
  meta?: {
    totalFlights: number
    searchId: string
  }
  errors?: Array<{
    code: string
    description: string
  }>
}

export interface QatarAirwaysFlight {
  // TODO: Define based on actual QR API response
  flightId: string
  segments: QatarAirwaysSegment[]
  totalQmiles: number
  totalTaxes: number
  currency: string
}

export interface QatarAirwaysJourney {
  journeyId: string
  segments: QatarAirwaysSegment[]
  fareOptions: QatarAirwaysFareOption[]
}

export interface QatarAirwaysSegment {
  flightNumber: string
  departureTime: string
  arrivalTime: string
  origin: string
  destination: string
  duration: number
  aircraft: string
  cabin: string
  operatingCarrier: string
}

export interface QatarAirwaysFareOption {
  fareType: string
  cabin: "economy" | "business" | "first"
  qmiles: number
  taxes: number
  currency: string
  bookingClass: string
  availability: number
}