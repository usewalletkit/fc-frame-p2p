import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { createGlideConfig, chains } from "@paywithglide/glide-js";

export const glideConfig = createGlideConfig({
    projectId: process.env.GLIDE_PROJECT_ID ?? '',

    chains: [chains.arbitrum, chains.optimism, chains.base],
  });