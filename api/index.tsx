import { Button, Frog } from 'frog'
import { handle } from 'frog/vercel'
import { baseColors } from "../lib/contracts.js";
import { createGlideClient, Chains, CurrenciesByChain } from "@paywithglide/glide-js";
import { encodeFunctionData, hexToBigInt, toHex } from 'viem';
import dotenv from 'dotenv';

// Uncomment this packages to tested on local server
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';

// Load environment variables from .env file
dotenv.config();


export const glideClient = createGlideClient({
  projectId: process.env.GLIDE_PROJECT_ID,
 
  // Lists the chains where payments will be accepted
  chains: [Chains.Base],
});


export const app = new Frog({
  assetsPath: '/',
  basePath: '/api/frame',
  imageAspectRatio: '1:1',
  headers: {
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate max-age=0, s-maxage=0',
  },
  imageOptions: {
    height: 1024,
    width: 1024,
    fonts: 
    [
      {
        name: 'Space Mono',
        source: 'google',
      }
    ]
  },
  browserLocation: 'https://www.basecolors.com/',
  
})


app.frame('/', async (c) => {
  return c.res({
    action: "/tx-status",
    image: '/intro.png',
    intents: [
      <Button.Transaction target="/mint">Mint with Degen</Button.Transaction>,
    ],
  })
})


app.transaction("/mint", async (c) => {
  const { address } = c;

  // Function to generate random color hex code
  function getRandomColorHex() {
    const getRandomValue = () => Math.floor(Math.random() * 256);
    const toHex = (value: number) => value.toString(16).padStart(2, '0');
    const r = getRandomValue();
    const g = getRandomValue();
    const b = getRandomValue();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  const color = getRandomColorHex();
  const name = color.substring(1);

  console.log(`Minting color: ${color}`);
  console.log(`Minting name: ${name}`);
 
  const { unsignedTransaction } = await glideClient.createSession( {
    payerWalletAddress: address,
 
    paymentCurrency: CurrenciesByChain.BaseMainnet.DEGEN,

    transaction: {
      chainId: Chains.Base.caip2,
      to: baseColors.address,
      value: toHex(1000000000000000n),
      input: encodeFunctionData({
        abi: baseColors.abi,
        functionName: "mint",
        args: [color, name, address as `0x${string}`],
      }),
    },
  });

  if (!unsignedTransaction) {
    throw new Error("missing unsigned transaction");
  }
 
  // Return the payment transaction to the user
  return c.send({
    chainId: "eip155:8453",
    to: unsignedTransaction.to,
    data: unsignedTransaction.input,
    value: hexToBigInt(unsignedTransaction.value),
  });
});


app.frame("/tx-status", async (c) => {
  const { transactionId, buttonValue } = c;
 
  // The payment transaction hash is passed with transactionId if the user just completed the payment. If the user hit the "Refresh" button, the transaction hash is passed with buttonValue.
  const txHash = transactionId || buttonValue;
 
  if (!txHash) {
    throw new Error("missing transaction hash");
  }
 
  try {
    let session = await glideClient.getSessionByPaymentTransaction( {
      chainId: Chains.Base.caip2,
      txHash,
    });
 
    // Wait for the session to complete. It can take a few seconds
    session = await glideClient.waitForSession(session.sessionId);
 
    return c.res({
      image: (
        <div
          style={{
            alignItems: 'center',
            background: 'white',
            backgroundSize: '100% 100%',
            display: 'flex',
            flexDirection: 'column',
            flexWrap: 'nowrap',
            height: '100%',
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%',
            color: 'black',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 0,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          <div style={{ color: 'black', display: 'flex', fontSize: 60, flexDirection: 'column', marginBottom: 60 }}>
            
            <p style={{ justifyContent: 'center', textAlign: 'center', fontSize: 48, margin: '0'}}>Successfully Minted!</p>
            
          </div>
        </div>
      ),
      intents: [
        <Button action="/">Buy again</Button>,
        <Button.Link
          href={`https://basescan.org/tx/${session.sponsoredTransactionHash}`}
        >
          View on Basescan
        </Button.Link>,
      ],
    });
  } catch (e) {
    // If the session is not found, it means the payment is still pending.
    // Let the user know that the payment is pending and show a button to refresh the status.
    return c.res({
      image: (
        <div
          style={{
            alignItems: 'center',
            background: 'white',
            backgroundSize: '100% 100%',
            display: 'flex',
            flexDirection: 'column',
            flexWrap: 'nowrap',
            height: '100%',
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%',
            color: 'red',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 0,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          <div style={{ color: 'red', display: 'flex', fontSize: 60, flexDirection: 'column', marginBottom: 60 }}>
            
            <p style={{ justifyContent: 'center', textAlign: 'center', fontSize: 48, margin: '0'}}>Waiting for payment confirmation..</p>
            
          </div>
        </div>
      ),
 
      intents: [
        <Button value={txHash} action="/tx-status">
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
