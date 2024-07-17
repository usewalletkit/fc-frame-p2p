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
import { 
  Chains, 
  CurrenciesByChain,
} from "@paywithglide/glide-js";
import { glideClient } from "./config.js"
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

const baseUrlNeynarV2 = process.env.BASE_URL_NEYNAR_V2;


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
        <Spacer size="14" />
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
      <Button action="/review">Continue</Button>,
    ],
  })
})


app.frame('/review', async (c) => {
  const { inputText } = c;

  try {
    // Fetch user by username
    const byUsernameResponse = await fetch(`${baseUrlNeynarV2}/user/search?q=${inputText}`, {
      method: 'GET',
      headers: {
          'accept': 'application/json',
          'api_key': process.env.NEYNAR_API_KEY || '',
      },
    });

    // Fetch user by address
    const byAddressResponse = await fetch(`${baseUrlNeynarV2}/user/bulk-by-address?addresses=${inputText}`, {
      method: 'GET',
      headers: {
          'accept': 'application/json',
          'api_key': process.env.NEYNAR_API_KEY || '',
      },
    });

    // Check if at least one response is okay
    if (!byUsernameResponse.ok && !byAddressResponse.ok) {
      return c.error(
        { 
          message: 'User not found!' 
        }
      );
    }

    // Parse the responses
    const dataUsername = byUsernameResponse.ok ? await byUsernameResponse.json() : null;
    const dataAddress = byAddressResponse.ok ? await byAddressResponse.json() : null;

    // Check if results are available in either response
    const username = dataUsername?.result?.users?.[0];
    const address = dataAddress ? (Object.values(dataAddress) as any)[0][0] : null;

    if (!username && !address) {
      return c.error(
        { 
          message: 'User not found!' 
        }
      );
    }

    // Get the fid from either username or address
    const toFid = username?.fid || address?.fid;

    if (!toFid) {
      return c.error( 
        { 
          message: 'User fid not found!' 
        }
      );
    }

    // Respond with the image and intents
    return c.res({
      image: `/review-image/${toFid}`,
      intents: [
        <TextInput placeholder="0.1 eth on base or 5 usdc" />,
        <Button action={`/send/${toFid}`}>Review</Button>,
      ],
    });
  } catch (error) {
    return c.error(
      { 
        message: 'An error occurred while searching for the user.' 
      }
    );
  }
});


app.image('/review-image/:toFid', async (c) => {
  const { toFid } = c.req.param();

  const response = await fetch(`${baseUrlNeynarV2}/user/bulk?fids=${toFid}`, {
    method: 'GET',
    headers: {
        'accept': 'application/json',
        'api_key': process.env.NEYNAR_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data || !data.users || data.users.length === 0) {
    throw new Error(`User not found!`);
  }

  const user = data.users[0];

  const pfpUrl = user.pfp_url;

  const displayName = user.display_name.length >= 15 ?  user.display_name.substring(0, 15) + "..." :  user.display_name;

  const username = user.username;

  const bio = user.profile.bio.text;

  const following = user.following_count;
  const followers = user.follower_count;

  function formatNumber(num: number) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
  
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
          <Box 
            backgroundColor="bg" 
            flex="2" 
            paddingRight="32" 
            display="flex"
            flexDirection="column"
            justifyContent="flex-end"
            paddingBottom="4"
          >
            <Image
              height="32"
              objectFit="cover"
              src="/images/primary.png"
            />

            <Spacer size="64" />
            <Text align="left" color="black" weight="600" size="24">
              Pay {displayName}
            </Text>
            <Spacer size="6" />
            <Text align="left" weight="400" color="grey" size="16">
              Send any token to {displayName} and they will receive ETH on Base.
            </Text>

            <Spacer size="10" />

            <Box 
              borderRadius="14"
              padding="14"
              background="blue"
              height="60"
              width="100%"
            >
              <Box 
                flexDirection="row" 
                alignItems="flex-start"
                display="flex"
              >
                <Icon name="info" color="white" size="18" />
                <Spacer size="10" />
                <Text align="left" weight="400" color="white" size="12">
                  Enter the amount and the token you want to send
                </Text>
              </Box>
            </Box>
          </Box>

          <Box 
            backgroundColor="bg" 
            flex="1" 
            paddingRight="36" 
            display="flex" 
            flexDirection="column"
            justifyContent="flex-end"
          >
            <Spacer size="10" />

            <img
              height="160"
              width="160"
              src={pfpUrl}
              style={{
                borderRadius: "15%",
                objectFit: "cover"
              }}
            />

            <Spacer size="6" />

            <Text align="left" weight="600" color="black" size="18">
              {displayName}
            </Text>
            <Text align="left" weight="400" color="grey" size="14">
              {username}
            </Text>
            <Spacer size="10" />
            <Text align="left" weight="400" color="black" size="12">
              {bio}
            </Text>

            <Spacer size="10" />

            <Box 
              flexDirection="row" 
              padding="0" 
              alignItems="center" 
              justifyContent="space-between"
              display="flex"
            >
              <Box flexDirection="row" alignItems="center" display="flex">
                <Text align="left" weight="600" color="black" size="12">
                  {formatNumber(following)}
                </Text>
                <Spacer size="4" />
                <Text align="left" color="grey" size="12">Following</Text>
              </Box>

              <Spacer size="10" />

              <Box flexDirection="row" alignItems="center" display="flex">
                <Text align="left" weight="600" color="black" size="12">
                  {formatNumber(followers)}
                </Text>
                <Spacer size="4" />
                <Text align="left" color="grey" size="12">Followers</Text>
              </Box>
            </Box>

          </Box>

        </Box>

      </Box>
    ),
  })
})


app.frame('/send/:toFid', (c) => {
  const { inputText } = c;

  const { toFid } = c.req.param();

  const paymentCurrency = "5 USDC";

  const ethAmount = "0.002";
  
  return c.res({
    image: `/send-image/${toFid}/${ethAmount}`,
    intents: [
      <Button.Transaction target="/send-tx">Send</Button.Transaction>,
    ],
  })
})


app.image('/send-image/:toFid/:ethAmount', async (c) => {
  const { toFid, ethAmount } = c.req.param();

  const response = await fetch(`${baseUrlNeynarV2}/user/bulk?fids=${toFid}`, {
    method: 'GET',
    headers: {
        'accept': 'application/json',
        'api_key': process.env.NEYNAR_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data || !data.users || data.users.length === 0) {
    throw new Error(`User not found!`);
  }

  const user = data.users[0];

  const displayName = user.display_name.length >= 10 ?  user.display_name.substring(0, 10) + "..." :  user.display_name;

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
          Pay {displayName}
        </Text>

        <Spacer size="10" />

        <Text align="left" weight="400" color="black" size="20">
          You are sending 5 USDC on Optimism.
        </Text>

        <Text align="left" weight="400" color="black" size="20">
          {displayName} will receive {ethAmount} ETH on Base.
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
                {ethAmount} ETH
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    ),
  })
})


app.transaction('/send-tx', async (c, next) => {
  await next();
  const txParams = await c.res.json();
  txParams.attribution = false;
  console.log(txParams);
  c.res = new Response(JSON.stringify(txParams), {
    headers: {
      "Content-Type": "application/json",
    },
  });
},
async (c) => {
  const { address } = c;
  
  const { unsignedTransaction } = await glideClient.createSession({
    payerWalletAddress: address,
   
    // Optional. Setting this restricts the user to only
    // pay with the specified currency.
    paymentCurrency: CurrenciesByChain.OptimismMainnet.ETH,
    
    transaction: {
      chainId: Chains.Base.caip2,
      // value: toHex(),
      // input: encodeFunctionData({
      //   abi: storageRegistry.abi,
      //   functionName: "rent",
      //   args: [BigInt(toFid), units],
      // }),
    },
  });

  if (!unsignedTransaction) {
    throw new Error("missing unsigned transaction");
  }

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
