# AwardWiz 2.0 — Full Rebuild

**Rebuild Status**: In Progress  
**Completed by**: Claude (Anthropic Assistant)  
**Date**: February 13, 2026

## Architecture Overview

AwardWiz 2.0 is built around **Arkalis**, a sophisticated anti-detection engine for web scraping that uses Chrome DevTools Protocol (CDP) directly rather than Puppeteer/Playwright.

### Key Components

1. **Arkalis Anti-Detection Engine** (`arkalis/`)
   - Direct CDP usage for maximum stealth
   - Human-like mouse control with Bezier curves
   - Random window positioning and sizing
   - Comprehensive domain blocking
   - Proxy support with dynamic session rolling
   - Advanced request interception and caching

2. **Scraper Framework** (`awardwiz-scrapers/`)
   - Standardized `FlightWithFares` data format
   - Plugin-based architecture
   - Error handling and retry logic
   - Rate limiting and bandwidth optimization

3. **Core Types**
   - `AwardWizQuery`: Search parameters (origin, destination, date)
   - `FlightWithFares`: Standardized flight data with fares array
   - `FlightFare`: Cabin class, miles, cash, booking codes

## Phase 1: ✅ COMPLETED - Core Update & Testing

### Dependencies Updated
- **Node.js**: Updated to require Node 22+
- **TypeScript**: Updated to 5.6.3
- **Chrome Launcher**: Updated to 1.1.2 
- **Chrome Remote Interface**: Updated to 0.33.2
- Fixed import compatibility issues for macOS

### Arkalis Engine Analysis
The anti-detection engine implements:

#### Browser Stealth Features
- **Random Window Coordinates**: Dynamic positioning and sizing
- **Domain Blocking**: Prevents tracking (Google Analytics, etc.)
- **Chrome Switches**: 20+ stealth parameters including:
  - `--disable-blink-features=AutomationControlled`
  - `--no-first-run --no-default-browser-check`
  - `--disable-features=AutofillServerCommunication`

#### Human-Like Interaction
- **Bezier Curve Mouse Movement**: Natural acceleration/deceleration
- **Random Click Points**: Clicks within element bounds, not center
- **Timing Jitter**: Random delays between actions

#### Anti-Botting Testing
- Automated testing against Sannysoft, Incolumitas, CreepJS
- TLS fingerprint analysis
- Navigator property validation
- Timezone consistency checks

#### Request Management
- **Bandwidth Tracking**: Monitors cache hits vs misses
- **URL Pattern Subscriptions**: Glob/regex matching
- **Response Interception**: JSON parsing and body extraction

### Cross-Platform Compatibility
Fixed macOS compatibility issues:
- Screen resolution detection fallback (xdpyinfo → 1920x1080)
- Node.js timer type corrections
- Import statement modernization

## Phase 2: 🟡 PARTIALLY COMPLETED - Scraper Verification

### Tested Scrapers

#### United Airlines
- **Status**: 🟡 **Needs Investigation**
- **URL Pattern**: `https://www.united.com/api/flight/FetchFlights`
- **Finding**: Scraper successfully navigates to United.com and loads all page resources, but the specific API endpoint may have changed or requires additional authentication.
- **Next Steps**: Manual inspection needed to find current API endpoint

#### Alaska Airlines  
- **Status**: ❌ **API Changed**
- **URL Pattern**: `https://www.alaskaair.com/searchbff/V3/search`
- **Finding**: Endpoint now returns HTML (`<!doctype`) instead of JSON
- **Action Required**: Research new Alaska Airlines API endpoint

### Remaining Scrapers to Test
- American Airlines
- Delta
- JetBlue  
- Southwest
- Aeroplan (Air Canada)

## Phase 3: 🚧 IN PROGRESS - New Scrapers

### Target Airlines for New Scrapers
1. **Air France / Flying Blue** 
2. **British Airways**
3. **Qatar Airways** 
4. **Emirates**

Each scraper will follow the established pattern:
- Navigate to search page with query parameters
- Intercept internal API calls
- Parse responses to `FlightWithFares` format
- Handle anti-botting countermeasures

## Phase 4: PENDING - AwardWallet Integration

Plan to create `awardwiz-scrapers/integrations/awardwallet.ts`:
- API key reading from `~/.openclaw/credentials/awardwallet.json`
- Balance fetching from AwardWallet API
- Program name mapping to scrapers

## Phase 5: PENDING - Transfer Partner Logic

Plan to create `awardwiz-scrapers/integrations/transfer-partners.ts`:
- Port transfer ratios from existing Python scripts
- Chase UR, Amex MR, Capital One calculations
- Balance accessibility analysis

## Phase 6: PENDING - CLI Tool

Plan to create unified CLI at `cli.ts`:
- Parallel scraper execution
- Balance integration
- JSON output with filtering options

## Phase 7: PENDING - Code Quality

Final tasks:
- TypeScript strict mode compliance
- Comprehensive error handling
- Documentation completion
- README.md updates

## Testing Configuration

**Test Route**: LAX → DXB (Los Angeles to Dubai)  
**Test Date**: 2026-04-28  
**Test Cabins**: Economy and Business  

This route was chosen as it's:
- International long-haul (good for testing complex searches)
- Served by multiple alliance partners
- Has substantial award availability typically

## Security & Ethics Notes

- **No Account Logins**: All scrapers work with public-facing pages only
- **Rate Limiting**: Built-in delays and retry logic
- **Respectful Scraping**: Bandwidth tracking and caching to minimize impact
- **Anti-Detection**: Designed to be undetectable while being ethical

## Known Issues

1. **United API Timeout**: Current scraper waits indefinitely for API response
2. **Alaska API Change**: Need to research new endpoint structure  
3. **TypeScript Warnings**: Some legacy type issues remain
4. **macOS Screen Detection**: Uses fallback resolution detection

## Next Priorities

1. **Research United/Alaska API changes**
2. **Implement Air France scraper** 
3. **Add timeout handling improvements**
4. **Create API endpoint discovery tools**