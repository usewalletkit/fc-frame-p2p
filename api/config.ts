import { createGlideClient, Chains } from "@paywithglide/glide-js";


export const glideClient = createGlideClient({
    projectId: process.env.GLIDE_PROJECT_ID,
   
    chains: [Chains.Arbitrum, Chains.Base],
  });