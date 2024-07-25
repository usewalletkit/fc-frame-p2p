import { Button, Frog, TextInput } from 'frog'
import { handle } from 'frog/vercel'
import { neynar } from 'frog/middlewares'
import {
  Box,
  Image,
  Icon,
  Text,
  Spacer,
  vars
} from "../lib/ui.js";
import {
  chains,
  currencies,
  createSession,
  CurrencyNotSupportedError,
  waitForSession,
  getSessionById,
  getSessionByPaymentTransaction
} from "@paywithglide/glide-js";
import { glideConfig } from "../lib/config.js"
import { formatUnits, hexToBigInt } from 'viem';
import dotenv from 'dotenv';

// Uncomment this packages to tested on local server
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'

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
}).use(
  neynar({
    apiKey: process.env.NEYNAR_API_KEY || 'NEYNAR_FROG_FM',
    features: ['interactor', 'cast'],
  }),
)


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
              @{username}
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


app.frame('/send/:toFid', async (c) => {
  const { inputText } = c;
  const { verifiedAddresses } = c.var.interactor || {}

  const { toFid } = c.req.param();
  const address = verifiedAddresses?.ethAddresses[0] || '';

  // Regular expression to match the input text format with optional chain
  const inputPattern = /(\d+(\.\d+)?\s+)(\w+)(?:\s+on\s+(\w+))?/i;
  const match = inputText ? inputText.match(inputPattern) : null;

  if (match) {
    const response = await fetch(`${baseUrlNeynarV2}/user/bulk?fids=${toFid}`, {
      method: 'GET',
      headers: {
          'accept': 'application/json',
          'api_key': process.env.NEYNAR_API_KEY || '',
      },
    });

    if (!response.ok) {
      return c.error({
        message: `HTTP error! Status: ${response.status}`,
      });
    }

    const data = await response.json();

    if (!data || !data.users || data.users.length === 0) {
      return c.error({
        message: `User not found!`,
      });
    }

    const user = data.users[0];

    const toEthAddress = user.verified_addresses.eth_addresses.toString().toLowerCase().split(',')[0];

    const amount = match[1].trim();
    const currency = match[3].toLowerCase();
    const chain = match[4] ? match[4].toLowerCase() : 'base'; // Default to 'base' if no chain is provided

    console.log(`Amount: ${amount}, Currency: ${currency}, Chain: ${chain}`);

    // Set the variables based on the parsed input
    const paymentAmount = amount;
    const paymentCurrency = currency;
    let parsedChain = chain;

    // Add logic to handle the chain and currency as needed
    let chainId;
    switch (parsedChain) {
      case 'eth':
      case 'ethereum':
      case 'mainnet':
        chainId = 'ethereum';
        break;
      case 'base':
        chainId = 'base';
        break;
      case 'optimism':
      case 'op':
        chainId = 'optimism';
        break;
      case 'arbitrum':
      case 'arb':
        chainId = 'arbitrum';
        break;
      case 'polygon':
        chainId = 'polygon';
        break;
      // Add other chains as needed
      default:
        chainId = 'base';
        break;
    }

    try {
      const paymentCurrencyOnChain = (currencies as any)[paymentCurrency].on((chains as any)[chainId]);
      if (!paymentCurrencyOnChain) {
        return c.error({
          message: 'Invalid currency or chain provided. Please try again.',
        });
      }
    } catch (error) {
      if (error instanceof CurrencyNotSupportedError) {
        return c.error({
          message: 'Currency not supported.',
        });
      } else {
        return c.error({
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    }

    // todo: Create a Glide session
    const paymentCurrencyOnChain = (currencies as any)[paymentCurrency].on((chains as any)[chainId]);

    try {
      const { sessionId } = await createSession(glideConfig, {
        chainId: chains.base.id,

        account: address as `0x${string}`,

        paymentCurrency: paymentCurrencyOnChain,
        paymentAmount: Number(paymentAmount),

        address: toEthAddress as `0x${string}`,
      });

      return c.res({
        action: `/tx-status`,
        image: `/send-image/${toFid}/${paymentAmount}/${paymentCurrency}/${chainId}/${sessionId}`,
        intents: [
          <Button.Transaction target={`/send-tx/${sessionId}`}>Send</Button.Transaction>,
        ],
      });
    } catch (error) {
      return c.error({
        message: 'Failed to create Glide session. Please try again.',
      });
    }
  } else {
    return c.error({
      message: 'Invalid input format. Please use the format: "<number> <currency> on <chain>"',
    });
  }
});


app.image('/send-image/:toFid/:paymentAmount/:paymentCurrency/:chainId/:sessionId', async (c) => {
  const { toFid, paymentAmount, paymentCurrency, chainId, sessionId } = c.req.param();
  
  const { sponsoredTransaction } = await getSessionById(glideConfig, sessionId); 

  if (!sponsoredTransaction) {
    throw new Error("missing sponsored transaction");
  }

  const ethValueInHex = sponsoredTransaction.value;

  const ethValue = formatUnits(hexToBigInt(ethValueInHex), 18)

  const displayEthValue = Number(ethValue) < 0.00001 ? 'NaN' : Number(ethValue).toFixed(5);

  const chainStr = chainId.charAt(0).toUpperCase() + chainId.slice(1);

  const paymentCurrencyUpperCase = paymentCurrency.toUpperCase();

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

  const displayName = user.display_name;

  const username = user.username;

  return c.res({
    image: (
      <Box
          grow
          alignVertical="center"
          backgroundColor="bg"
          padding="32"
          textAlign="center"
          height="100%"
      >

        <Image
              height="28"
              objectFit="cover"
              src="/images/primary.png"
            />

        <Box backgroundColor="bg" alignHorizontal="center">

        <img
              height="96"
              width="96"
              src={pfpUrl}
              style={{
                borderRadius: "15%",
                objectFit: "cover"
              }}
            />

        </Box>

        <Spacer size="4" />

        <Text align="center" color="black" weight="600" size="24">
          Pay {displayName}
        </Text>

        <Spacer size="10" />

        <Text align="center" color="grey" weight="400" size="14">
          @{username}
        </Text>

        <Spacer size="10" />

        <Text align="center" weight="400" color="grey" size="16">
          You are sending {paymentAmount} {paymentCurrencyUpperCase} on {chainStr}.
        </Text>

        <Spacer size="6" />

        <Text align="center" weight="400" color="grey" size="16">
          {displayName} will receive 0 ETH on Base.
        </Text>

        <Spacer size="32" />

        <Box grow flexDirection="row" gap="8">

          <Box backgroundColor="bg" flex="1" height="60" alignHorizontal="center" />

          <Box backgroundColor="bg" flex="2" height="60" alignHorizontal="center">
            <Text align="right" weight="600" color="grey" size="12">
              YOU SEND
            </Text>

            <Spacer size="8" />

            <Box flexDirection="row">
              <Image
                  height="22"
                  objectFit="cover"
                  src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=032"
                />
              <Spacer size="8" />
              <Text align="center" weight="600" color="black" size="20">
                {paymentAmount} {paymentCurrencyUpperCase}
              </Text>
            </Box>
          </Box>

          <Box backgroundColor="bg" flex="1" alignHorizontal="center" justifyContent="center" height="60" >
            <Icon name="arrow-right" color="green" size="32" />
          </Box>

          <Box backgroundColor="bg" flex="2" height="60" alignHorizontal="center" >
            <Text align="center" weight="600" color="grey" size="12">
              THEY RECEIVE
            </Text>

            <Spacer size="8" />

            <Box flexDirection="row">
              <Image
                  height="22"
                  objectFit="cover"
                  src="https://cryptologos.cc/logos/ethereum-eth-logo.png?v=032"
                />
              <Spacer size="8" />
              <Text align="center" weight="600" color="black" size="20">
                {displayEthValue} ETH
              </Text>
            </Box>
          </Box>

          <Box backgroundColor="bg" flex="1" height="60" alignHorizontal="center" />

        </Box>
      </Box>
    ),
  })
})


app.transaction('/send-tx/:sessionId', async (c, next) => {
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
  const { sessionId } = c.req.param();

  const { unsignedTransaction } = await getSessionById(glideConfig, sessionId)

  if (!unsignedTransaction) {
    throw new Error("missing unsigned transaction");
  }

  return c.send({
    chainId: unsignedTransaction.chainId as any,
    to: unsignedTransaction.to || undefined,
    data: unsignedTransaction.input || undefined,
    value: hexToBigInt(unsignedTransaction.value),
  })
})


app.frame("/tx-status", async (c) => {
  const { transactionId, buttonValue } = c;

  // The payment transaction hash is passed with transactionId if the user just completed the payment. If the user hit the "Refresh" button, the transaction hash is passed with buttonValue.
  const txHash = transactionId || buttonValue;

  if (!txHash) {
    throw new Error("missing transaction hash");
  }

  try {
    let session = await getSessionByPaymentTransaction(glideConfig, {
      chainId: chains.base.id,
      hash: txHash as any,
    });
    // Wait for the session to complete. It can take a few seconds
    session = await waitForSession(glideConfig, session.sessionId);

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

          <Text align="center" color="black" weight="600" size="24">
            Transaction completed!
          </Text>

          <Spacer size="96" />

        </Box>
      ),
      intents: [
        <Button.Link
          href={`https://basescan.org/tx/${session.sponsoredTransactionHash}`}
        >
          View on BaseScan
        </Button.Link>,
      ],
    });
  } catch (e) {
    // If the session is not found, it means the payment is still pending.
    // Let the user know that the payment is pending and show a button to refresh the status.
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

        <Text align="center" color="black" weight="600" size="24">
          Waiting for payment confirmation..
        </Text>

        <Spacer size="96" />
        
      </Box>
      ),

      intents: [
        <Button value={txHash} action={`/tx-status`}>
          Refresh
        </Button>,
      ],
    });
  }
});


// Uncomment for local server testing
devtools(app, { serveStatic });


export const GET = handle(app)
export const POST = handle(app)
