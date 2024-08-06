import { fetchWithRetry } from "./fetchWithRetry.js";

const cache = new Map();
const baseUrlNeynarV2 = process.env.BASE_URL_NEYNAR_V2;

export async function fetchUserData(fid: string) {
  if (cache.has(fid)) {
    return cache.get(fid);
  }

  const url = `${baseUrlNeynarV2}/user/bulk?fids=${fid}`;
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      api_key: process.env.NEYNAR_API_KEY || "",
    },
  };

  const data = await fetchWithRetry(url, options);
  if (!data || !data.users || data.users.length === 0) {
    throw new Error("User not found!");
  }

  const user = data.users[0];
  cache.set(fid, user);
  return user;
}
