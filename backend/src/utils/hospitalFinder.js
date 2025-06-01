const axios = require('axios');

async function findNearbyHospitals(lat, lng) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // Step 1: Search for nearby hospitals
  const nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=hospital&key=${apiKey}`;
  const nearbyRes = await axios.get(nearbySearchUrl);

  const hospitals = await Promise.all(
    nearbyRes.data.results.slice(0, 5).map(async (place) => {
      let phone = "Not available";
      try {
        // Step 2: Fetch details for each hospital using Place Details API
        // Request 'formatted_phone_number' field
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number&key=${apiKey}`;
        const detailsRes = await axios.get(detailsUrl);

        if (
          detailsRes.data.result &&
          detailsRes.data.result.formatted_phone_number
        ) {
          // Extract the phone number directly.
          // The 'tel:' prefix and any formatting for display should be handled by your bot's output logic,
          // not within the data fetching.
          phone = detailsRes.data.result.formatted_phone_number;
        }
      } catch (e) {
        console.error(`Error fetching details for ${place.name}:`, e.message);
        // Keep phone as "Not available" on error
      }
      return {
        name: place.name,
        address: place.vicinity,
        phone,
      };
    })
  );

  return hospitals;
}

module.exports = { findNearbyHospitals };