import { Button, Frog, parseEther, TextInput } from 'frog'
import { handle } from 'frog/vercel'
import { 
  Box, 
  Image, 
  Icon, 
  Text, 
  Spacer, 
  vars 
} from "../lib/ui.js";
// import { 
//   Chains, 
//   CurrenciesByChain,
// } from "@paywithglide/glide-js";
// import { glideClient } from "./config.js"
import dotenv from 'dotenv';

// Uncomment this packages to tested on local server
// import { devtools } from 'frog/dev'
// import { serveStatic } from 'frog/serve-static'

// Load environment variables from .env file
dotenv.config();


const baseUrl = "https://warpcast.com/~/compose";
const text = "@paywithglide P2P Transfer 💸\n\nFrame by @tusharsoni.eth & @0x94t3z.eth";
const embedUrl = "https://paywithglide.vercel.app/api/frame";

const CAST_INTENS = `${baseUrl}?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`;


export const app = new Frog({
  assetsPath: '/',
  basePath: '/api/frame',
  ui: { vars },
  title: 'PayWithGlide.xyz',
  browserLocation: CAST_INTENS,
  headers: {
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate max-age=0, s-maxage=0',
  },
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
            <Text align="left" color="black" weight="600" size="24">
              Send tokens to anyone from any chain
            </Text>
            <Spacer size="10" />
            <Text align="left" weight="400" color="grey" size="16">
              Send any token to Farcaster users and they will receive ETH on Base.
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


app.frame('/continue', (c) => {
  return c.res({
    image: '/continue-image',
    intents: [
      <TextInput placeholder="0.1 eth on base or 5 usdc" />,
      <Button action="/send">Review</Button>,
    ],
  })
})


app.image('/continue-image', (c) => {

  function formatNumber(num: number) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  const following = 125;
  const followers = 1067;
  
  return c.res({
    headers: {
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate max-age=0, s-maxage=0',
    },
    image: (
      <Box
          grow
          alignVertical="center"
          backgroundColor="bg"
          padding="32"
          textAlign="left"
          height="100%"
      >
        
        <Box grow flexDirection="row" gap="8">
          <Box backgroundColor="bg" flex="2" paddingRight="32" paddingTop="60" >
            <Text align="left" color="black" weight="600" size="24">
              Pay 0x94t3z 📟 ✦⁺
            </Text>
            <Spacer size="10" />
            <Text align="left" weight="400" color="grey" size="16">
              Send any token to 0x94t3z 📟 ✦⁺ and they will receive ETH on Base.
            </Text>

            <Spacer size="16" />

            <Box 
              borderStyle="solid"
              borderWidth="1"
              borderRadius="16"
              padding="18"
              background="blue"
              height="80"
              width="100%"
            >
              <Box 
                flexDirection="row" 
                alignHorizontal="left" 
                alignVertical="center"
              >
                <Icon name="info" color="white" size="18" />
                <Spacer size="10" />
                <Text align="left" weight="400" color="white" size="16">
                  Enter the amount and the token you wish to send
                </Text>
              </Box>
            </Box>
          </Box>

          <Box backgroundColor="bg" flex="1" paddingRight="36" >
            <img
                height="180"
                width="180"
                src="https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/1889baf9-da5a-42d3-2727-5adf1a206200/original"
                style={{
                  borderRadius: "15%",
                }}
              />
            <Spacer size="6" />
            <Text align="left" weight="600" color="black" size="18">
              0x94t3z 📟 ✦⁺
            </Text>
            <Text align="left" weight="400" color="grey" size="14">
              @0x94t3z.eth
            </Text>
            <Spacer size="8" />
            <Text align="left" weight="400" color="black" size="12">
              Farcaster Builder 🧢🎒- 2nd of @mr94t3z (shadow banned). Trying to build /castcred 🥽
            </Text>
            <Spacer size="8" />
            <Box flexDirection="row" justifyContent="center">
              <Text align="left" weight="600" color="black" size="12">
                {formatNumber(following)}
              </Text>
              <Spacer size="8" />
              <Text align="center" color="grey" size="12"> Following</Text>
              <Spacer size="10" />
              <Text align="left" weight="600" color="black" size="12">
                 {formatNumber(followers)}
              </Text>
              <Spacer size="8" />
              <Text align="center" color="grey" size="12"> Followers</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    ),
  })
})


app.frame('/send', (c) => {
  return c.res({
    image: '/send-image',
    intents: [
      <Button.Transaction target="/send-tx">Send</Button.Transaction>,
    ],
  })
})


app.image('/send-image', (c) => {
  const displayName = "0x94t3z 📟 ✦⁺";

  const truncatedDisplayName = displayName.length >= 10 ? displayName.substring(0, 10) + "..." : displayName;

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
        <Spacer size="16" />

        <Text align="left" color="black" weight="600" size="48">
          Pay {truncatedDisplayName}
        </Text>

        <Spacer size="10" />

        <Text align="left" weight="400" color="black" size="20">
          You are sending 5 USDC on Optimism.
        </Text>

        <Text align="left" weight="400" color="black" size="20">
          {truncatedDisplayName} will receive 0.002 ETH on Base.
        </Text>
        
        <Spacer size="48" />

        <Box grow flexDirection="row" gap="8">
          <Box backgroundColor="bg" flex="1" height="60">
            <Text align="left" weight="400" color="grey" size="20">
              You Send
            </Text>

            <Spacer size="32" />
            
            <Box flexDirection="row">
              <Image
                  height="26"
                  objectFit="cover"
                  src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=032"
                />
              <Spacer size="8" />
              <Text align="left" weight="600" color="black" size="24">
                5 USDC
              </Text>
            </Box>
          </Box>

          <Box backgroundColor="bg" flex="1" alignHorizontal="center" justifyContent="center" height="60">
            <Icon name="arrow-right" color="black" size="32" />
          </Box>

          <Box backgroundColor="bg" flex="2" height="60">
            <Text align="left" weight="400" color="grey" size="20">
              They Receive
            </Text>

            <Spacer size="32" />
            
            <Box flexDirection="row">
              <Image
                  height="26"
                  objectFit="cover"
                  src="https://cryptologos.cc/logos/ethereum-eth-logo.png?v=032"
                />
              <Spacer size="8" />
              <Text align="left" weight="600" color="black" size="24">
                0.002 ETH
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    ),
  })
})


app.transaction('/send-tx', (c) => {
  // Send transaction response.
  return c.send({
    chainId: 'eip155:8453',
    to: '0xc698865c38eC12b475AA55764d447566dd54c758',
    value: parseEther('0.002'),
  })
})


// Uncomment for local server testing
// devtools(app, { serveStatic });


export const GET = handle(app)
export const POST = handle(app)
