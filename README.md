# AwardWiz 2.0 🛫

**Modernized award flight search engine with advanced anti-detection**

AwardWiz 2.0 is a complete rebuild of the award flight search system, featuring a sophisticated anti-botting engine and unified CLI for searching award flights across multiple airline programs.

## ✨ Features

- **🤖 Advanced Anti-Detection**: Arkalis engine with human-like behavior patterns
- **⚡ Parallel Scraping**: Search multiple airlines simultaneously  
- **💳 AwardWallet Integration**: Automatic balance fetching and transfer calculations
- **🔄 Transfer Partner Logic**: Calculate accessible miles through credit card transfers
- **📊 Rich Output**: JSON results with detailed flight and fare information
- **🛡️ Error Resilient**: Robust retry logic and graceful failure handling
- **🎯 CLI Interface**: Simple command-line interface for all operations

## 🏗️ Architecture

### Arkalis Anti-Detection Engine (`arkalis/`)

Sophisticated web scraping framework that avoids detection by:

- **Human-like Mouse Control**: Bezier curve movements with acceleration/deceleration
- **Randomized Browser Profiles**: Dynamic window sizes, positions, and timings
- **Domain Blocking**: Prevents tracking domains from loading
- **Proxy Support**: HTTP/SOCKS5 with dynamic session rolling
- **Advanced Stealth**: 20+ Chrome flags for maximum invisibility
- **Request Interception**: Monitor and analyze network traffic

### Scraper Framework (`awardwiz-scrapers/`)

Standardized framework for airline scrapers featuring:

- **Uniform Data Format**: All scrapers output `FlightWithFares` objects
- **Error Handling**: Comprehensive timeout and retry mechanisms
- **Cache Support**: Browser and API response caching
- **Bandwidth Tracking**: Monitor and optimize request patterns

### Integrations (`awardwiz-scrapers/integrations/`)

- **AwardWallet API**: Fetch user balances across all programs
- **Transfer Partners**: Calculate miles accessible through credit card transfers
- **Smart Mapping**: Automatic program name resolution

## 🚀 Installation

### Prerequisites

- **Node.js 22+** (required)
- **Chrome/Chromium** (for web scraping)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd awardwiz

# Install dependencies
npm install

# Set up AwardWallet credentials (optional)
npx tsx cli.ts setup
# Edit ~/.openclaw/credentials/awardwallet.json with your API key
```

## 📖 Usage

### Search Award Flights

```bash
# Basic search
npx tsx cli.ts search -f LAX -t DXB -d 2026-04-28

# Search specific programs
npx tsx cli.ts search -f JFK -t LHR -d 2026-06-15 -p united,british-airways

# Include balance information
npx tsx cli.ts search -f SFO -t NRT -d 2026-08-20 --balances

# Custom output file and timeout
npx tsx cli.ts search -f LAX -t SYD -d 2026-12-25 -o holiday-flights.json --timeout 60
```

### View Balances and Transfers

```bash
# Show all balances with transfer options
npx tsx cli.ts balances

# Save to specific file
npx tsx cli.ts balances -o my-balances.json
```

### List Available Scrapers

```bash
npx tsx cli.ts list
```

## 🛠️ Available Scrapers

### ✅ Working
- **United Airlines** (`united`) - MileagePlus program *(slow but functional)*

### 🔴 Needs Fix (API Changed) 
- **Alaska Airlines** (`alaska`) - Mileage Plan program *(returns HTML instead of JSON)*
- **Air Canada Aeroplan** (`aeroplan`) - Aeroplan program *(timeout waiting for API)*

### 🚧 New Scrapers (Research Needed)
- **Air France** (`airfrance`) - Flying Blue program *(scaffold created)*
- **British Airways** (`britishairways`) - Executive Club program *(scaffold created)*  
- **Qatar Airways** (`qatarairways`) - Privilege Club program *(scaffold created)*
- **Emirates** (`emirates`) - Skywards program *(scaffold created)*

### 🏗️ Existing (Not Yet Enabled)
- **American Airlines** (`aa`) - AAdvantage program  
- **Delta Air Lines** (`delta`) - SkyMiles program
- **JetBlue Airways** (`jetblue`) - TrueBlue program
- **Southwest Airlines** (`southwest`) - Rapid Rewards program

> **Note**: Scrapers marked as needing research have skeleton implementations but require API endpoint discovery. See `SCRAPER_RESEARCH_NEEDED.md` for detailed tasks.

## 💳 Transfer Partner Support

Credit card programs supported for transfer calculations:

- **Chase Ultimate Rewards** - Transfers to United, Air France, British Airways, Southwest
- **Amex Membership Rewards** - Transfers to Delta, Air France, British Airways, Emirates  
- **Capital One** - Transfers to Air France, British Airways, Emirates
- **Citi ThankYou Points** - Transfers to Air France, Emirates
- **Bilt Rewards** - Transfers to United, Alaska, American, Air France, Emirates

## 📊 Output Format

### Search Results (`results.json`)

```json
{
  "query": {
    "origin": "LAX",
    "destination": "DXB", 
    "departureDate": "2026-04-28"
  },
  "timestamp": "2026-02-13T22:50:00.000Z",
  "totalFlights": 15,
  "scraperResults": [
    {
      "scraper": "united",
      "status": "success",
      "flights": [
        {
          "flightNo": "UA 935",
          "departureDateTime": "2026-04-28 14:30",
          "arrivalDateTime": "2026-04-29 18:45", 
          "origin": "LAX",
          "destination": "DXB",
          "duration": 870,
          "aircraft": "Boeing 777-300ER",
          "fares": [
            {
              "cabin": "business",
              "miles": 80000,
              "cash": 400,
              "currencyOfCash": "USD",
              "bookingClass": "I",
              "scraper": "united"
            }
          ],
          "amenities": {
            "hasPods": true,
            "hasWiFi": true
          }
        }
      ]
    }
  ]
}
```

### Balance Results (`balances.json`)

```json
{
  "timestamp": "2026-02-13T22:50:00.000Z",
  "balances": [...],
  "transferCalculations": [
    {
      "scraperName": "united",
      "programName": "United MileagePlus",
      "directBalance": 25000,
      "transferableBalance": 125000,
      "transferOptions": [
        {
          "fromProgram": "chase-ur",
          "toProgram": "united", 
          "availablePoints": 100000,
          "transferRatio": 1,
          "resultingMiles": 100000,
          "transferTime": "instant"
        }
      ]
    }
  ]
}
```

## 🔧 Development

### Adding New Scrapers

1. Create scraper file: `awardwiz-scrapers/scrapers/airline-name.ts`
2. Implement required interface:

```typescript
import { AwardWizScraper, FlightWithFares } from '../awardwiz-types.js'

export const meta = {
  name: "airline-name",
  blockUrls: ["tracking-domain.com"]
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  // Navigate to search page
  arkalis.goto(`https://airline.com/search?from=${query.origin}&to=${query.destination}&date=${query.departureDate}`)
  
  // Wait for API response
  const result = await arkalis.waitFor({
    "success": { type: "url", url: "https://airline.com/api/flights" }
  })
  
  // Parse and return standardized data
  const flights: FlightWithFares[] = parseResponse(result.response.body)
  return flights
}
```

3. Add to CLI scraper registry in `cli.ts`

### Testing

```bash
# Test Arkalis core functionality
npx tsx -e "
import { runArkalis } from './arkalis/arkalis.js';
runArkalis(async (arkalis) => {
  arkalis.goto('https://www.google.com');
  await arkalis.wait(2000);
  return 'success';
}, {}, {name: 'test'}, 'test');
"

# Test specific scraper
npx tsx cli.ts search -f LAX -t DXB -d 2026-04-28 -p united --verbose
```

## ⚡ Performance & Limitations

### Performance
- **Parallel Execution**: All scrapers run simultaneously
- **Smart Caching**: Browser cache and API response caching
- **Resource Optimization**: Blocks tracking domains and unused resources
- **Bandwidth Monitoring**: Track data usage per scraper

### Current Limitations
- **United Airlines**: API endpoint verification needed
- **Alaska Airlines**: API structure changed, needs update
- **Rate Limiting**: Some airlines may detect high-frequency requests
- **Geographic Restrictions**: Some sites may be region-locked

## 🛡️ Security & Ethics

- **No Account Login**: All scrapers work with public-facing search pages only
- **Respectful Scraping**: Built-in delays and bandwidth monitoring
- **Anti-Detection**: Designed to be undetectable while remaining ethical
- **No Credential Storage**: User credentials never stored or transmitted

## 🤝 Contributing

1. **Report Issues**: Found a broken scraper? Open an issue!
2. **Add Scrapers**: Implement support for new airlines
3. **Improve Anti-Detection**: Enhance Arkalis stealth capabilities
4. **Documentation**: Help improve setup and usage guides

## 📄 License

[Add license information]

## 🙏 Acknowledgments

- Original AwardWiz project foundation
- OpenClaw framework integration
- Arkalis anti-detection engine innovation

---

**⚠️ Disclaimer**: This tool is for educational purposes. Users are responsible for complying with websites' terms of service and applicable laws. Always respect rate limits and use responsibly.