import { getContract } from "thirdweb";
import { createThirdwebClient } from "thirdweb";
import { baseColors } from "./contracts.js";
import { base } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: "40d6029fa13ca5062533fc0b41c5dbf1",
});

export const contract = getContract({
  client,
  chain: base,
  address: baseColors.address,
  abi: baseColors.abi,
});