import { chains, createGlideConfig } from "@paywithglide/glide-js";

export const glideConfig = createGlideConfig({
  projectId: process.env.GLIDE_PROJECT_ID ?? "",

  chains: [
    chains.ethereum,
    chains.arbitrum,
    chains.base,
    chains.degen,
    chains.gnosis,
    chains.optimism,
    chains.zora,
  ],
});
