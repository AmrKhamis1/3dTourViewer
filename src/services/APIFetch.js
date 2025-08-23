// Simple cached fetcher for data from public/api.json
// Exports helpers to get, refresh, and clear the cached data

let cachedApiData = null;
let inFlightFetch = null;

function resolveApiUrl() {
  const baseUrl =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.BASE_URL
      ? import.meta.env.BASE_URL
      : "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}/api.json`;
}

async function fetchApiJson(options = {}) {
  const url = resolveApiUrl();
  const response = await fetch(url, {
    // For normal fetches, allow HTTP caching; for refresh, caller can pass { cache: 'no-store' }
    cache: options.cache || "default",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch API data: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function getApiData({ forceRefresh = false } = {}) {
  if (cachedApiData && !forceRefresh) {
    return cachedApiData;
  }

  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      const data = await fetchApiJson({
        cache: forceRefresh ? "no-store" : "default",
      });
      cachedApiData = data;
      return data;
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export function clearApiCache() {
  cachedApiData = null;
}

export async function refreshApiData() {
  clearApiCache();
  return getApiData({ forceRefresh: true });
}

export default getApiData;

export async function getPosition(locationSelector) {
  const data = await getApiData();
  const location = data.data.model.locations[locationSelector];
  const position = location?.pano?.position;
  if (!position) {
    throw new Error(
      "Position not found at data.model.locations[].pano.position"
    );
  }
  return position;
}

export async function getRotation(locationSelector) {
  const data = await getApiData();
  const location = data.data.model.locations[locationSelector];
  const rotation = location?.pano?.rotation;
  if (!rotation) {
    throw new Error(
      "Rotation not found at data.model.locations[].pano.rotation"
    );
  }
  return rotation;
}

export async function getPanos(resolution = "low", locationSelector) {
  const desiredResolution = String(resolution).toLowerCase();
  const data = await getApiData();
  const location = data.data.model.locations[locationSelector];
  const skyboxes = location?.pano?.skyboxes || [];
  const match = skyboxes.find(
    (s) => String(s?.resolution).toLowerCase() === desiredResolution
  );
  if (!match || !Array.isArray(match.children)) {
    throw new Error(
      `Skyboxes for resolution '${resolution}' not found or invalid at data.model.locations[].pano.skyboxes`
    );
  }

  // Ensure URLs work in dev and prod (respecting BASE_URL)
  return match.children.map((relativePath) => `${relativePath}`);
}

