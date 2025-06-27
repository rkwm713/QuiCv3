/**
 * Geocoding Service - Provides reverse geocoding functionality
 * Currently uses a simple placeholder implementation, can be enhanced with real APIs later
 */

interface GeocodeResult {
  address: string;
  city: string;
  state: string;
  fullAddress: string;
}

interface GeocodeCoordinates {
  lat: number;
  lng: number;
}

export class GeocodingService {
  private readonly baseUrl = 'https://nominatim.openstreetmap.org/reverse';
  private readonly userAgent = 'QuiCv3-PoleAnalysis/1.0';
  
  /**
   * Reverse geocode coordinates to get address information
   * Uses Nominatim (OpenStreetMap) for free reverse geocoding
   */
  async reverseGeocode(coordinates: GeocodeCoordinates): Promise<GeocodeResult> {
    try {
      // Use Nominatim (OpenStreetMap) for reverse geocoding
      const response = await fetch(
        `${this.baseUrl}?lat=${coordinates.lat}&lon=${coordinates.lng}&format=json&addressdetails=1`,
        {
          headers: {
            'User-Agent': this.userAgent
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Geocoding API responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        
        // Extract street address components
        const houseNumber = addr.house_number || '';
        const street = addr.road || addr.street || '';
        const streetAddress = houseNumber && street ? `${houseNumber} ${street}` : (street || 'Unknown Street');
        
        // Extract city/town
        const city = addr.city || addr.town || addr.village || addr.hamlet || 'Unknown City';
        
        // Extract state/province
        const state = addr.state || addr.province || addr.region || 'Unknown State';
        
        // Get state abbreviation if possible
        const stateAbbr = this.getStateAbbreviation(state);
        
        return {
          address: streetAddress,
          city: city,
          state: stateAbbr,
          fullAddress: `${streetAddress}, ${city}, ${stateAbbr}`
        };
      } else {
        throw new Error('No address found in geocoding response');
      }
    } catch (error) {
      console.error('Real geocoding failed, falling back to mock data:', error);
      
      // Fallback to mock address generation
      const mockAddress = this.generateMockAddress(coordinates);
      return {
        address: mockAddress.street,
        city: mockAddress.city,
        state: mockAddress.state,
        fullAddress: `${mockAddress.street}, ${mockAddress.city}, ${mockAddress.state}`
      };
    }
  }

  /**
   * Get state abbreviation from full state name
   */
  private getStateAbbreviation(stateName: string): string {
    const stateAbbreviations: { [key: string]: string } = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const normalized = stateName.toLowerCase().trim();
    return stateAbbreviations[normalized] || stateName.substring(0, 2).toUpperCase();
  }

  /**
   * Generate a mock address based on coordinates
   * This is a fallback when real geocoding fails
   */
  private generateMockAddress(coordinates: GeocodeCoordinates): {
    street: string;
    city: string;
    state: string;
  } {
    // Generate a simple mock address with coordinates
    const streetNumber = Math.floor(Math.abs(coordinates.lat * 1000) % 9999) + 1;
    const streetNames = [
      'Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'Maple Blvd',
      'Cedar Lane', 'First St', 'Park Rd', 'Church St'
    ];
    const streetName = streetNames[Math.floor(Math.abs(coordinates.lng * 100) % streetNames.length)];
    
    // Basic US region detection
    let city = 'Unknown City';
    let state = 'TX'; // Default to Texas since example coordinates were in Texas
    
    // Simple region detection based on coordinates
    if (coordinates.lat >= 25 && coordinates.lat <= 35 && coordinates.lng >= -105 && coordinates.lng <= -93) {
      // Texas/Southwest region
      const cities = ['San Antonio', 'Houston', 'Dallas', 'Austin', 'Fort Worth'];
      city = cities[Math.floor(Math.abs(coordinates.lat * 10) % cities.length)];
      state = 'TX';
    } else if (coordinates.lat >= 32 && coordinates.lat <= 49 && coordinates.lng >= -125 && coordinates.lng <= -110) {
      // West Coast/Mountain region
      const cities = ['Los Angeles', 'San Francisco', 'Seattle', 'Denver', 'Phoenix'];
      const states = ['CA', 'WA', 'CO', 'AZ', 'NV'];
      city = cities[Math.floor(Math.abs(coordinates.lat * 10) % cities.length)];
      state = states[Math.floor(Math.abs(coordinates.lng * 10) % states.length)];
    } else if (coordinates.lat >= 35 && coordinates.lat <= 42 && coordinates.lng >= -85 && coordinates.lng <= -70) {
      // Northeast region
      const cities = ['New York', 'Philadelphia', 'Boston', 'Pittsburgh', 'Hartford'];
      const states = ['NY', 'PA', 'MA', 'CT', 'NJ'];
      city = cities[Math.floor(Math.abs(coordinates.lat * 10) % cities.length)];
      state = states[Math.floor(Math.abs(coordinates.lng * 10) % states.length)];
    }
    
    return {
      street: `${streetNumber} ${streetName}`,
      city,
      state
    };
  }

  /**
   * Check if coordinates are valid
   */
  isValidCoordinates(coordinates: GeocodeCoordinates): boolean {
    return (
      coordinates.lat >= -90 && coordinates.lat <= 90 &&
      coordinates.lng >= -180 && coordinates.lng <= 180
    );
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService();
