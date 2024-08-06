export async function fetchWithRetry(
  url: string | URL | Request,
  options: RequestInit | undefined,
  retries = 5,
  delay = 1000,
) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response.json();
    }
    if (response.status === 429 && i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    } else {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  }
}
