import { Button, Frog, TextInput } from 'frog'
import { handle } from 'frog/vercel'
import { Box, Image, Heading, Text, VStack, Spacer, vars } from "../lib/ui.js";
import { createGlideClient, Chains, CurrenciesByChain } from "@paywithglide/glide-js";
import dotenv from 'dotenv';

// Uncomment this packages to tested on local server
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'

// Load environment variables from .env file
dotenv.config();


export const glideClient = createGlideClient({
  projectId: process.env.GLIDE_PROJECT_ID,
 
  chains: [Chains.Arbitrum, Chains.Base],
});

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api/frame',
  ui: { vars },
  headers: {
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate max-age=0, s-maxage=0',
  },
  title: 'PayWithGlide.xyz'
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})

app.frame('/', (c) => {
  return c.res({
    image: (
      <Box
          grow
          alignVertical="center"
          backgroundColor="bg"
          padding="32"
          textAlign="left"
          height="100%"
      >
        <Spacer size="10" />
        <Image
          height="32"
          objectFit="cover"
          src="/images/primary.png"
        />
        <Spacer size="96" />
        <Box grow flexDirection="row" gap="8">
          <Box backgroundColor="bg" flex="1" >
            <Text color="black" weight="600" align="center" size="24">
              Send tokens to anyone from any chain
            </Text>
            <Spacer size="10" />
            <Text align="left" weight="400" color="grey" size="16">
              Send any token to fc users and they will receive ETH on Base.
            </Text>
          </Box>
          <Box backgroundColor="bg" flex="1" >
          </Box>
        </Box>
      </Box>
    ),
    intents: [
      <TextInput placeholder="dwr.eth or 0xc69...c758" />,
      <Button action="/continue">Continue</Button>,
    ],
  })
})


// Uncomment for local server testing
devtools(app, { serveStatic });

export const GET = handle(app)
export const POST = handle(app)
