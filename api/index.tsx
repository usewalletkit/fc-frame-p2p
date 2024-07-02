import { Button, Frog } from 'frog'
import { handle } from 'frog/vercel'
import { baseColors } from "../lib/contracts.js";
// import { createGlideClient, Chains, CurrenciesByChain } from "@paywithglide/glide-js";
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
  // const color = "#000000"
  // const color_data = await baseColors.read.getTokenAttributes([color]);

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
  const color = "#432889";
  const name = color.substring(1);
 
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
    chainId: Chains.Base,
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
            display: "flex",
            justifyContent: "center",
            fontSize: 64,
            marginTop: "200px",
          }}
        >
          Mint complete!
        </div>
      ),
      intents: [
        <Button.Link
          href={`https://explorer.zora.energy/tx/${session.sponsoredTransactionHash}`}
        >
          View on Zora
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
            display: "flex",
            justifyContent: "center",
            fontSize: 44,
            marginTop: "200px",
          }}
        >
          Waiting for payment confirmation..
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


// app.frame("/tx-status", async (c) => {
//   const { transactionId, buttonValue } = c;
 
//   // The payment transaction hash is passed with transactionId if the user just completed the payment. If the user hit the "Refresh" button, the transaction hash is passed with buttonValue.
//   const txHash = transactionId || buttonValue;
 
//   if (!txHash) {
//     throw new Error("missing transaction hash");
//   }
 
//   try {
//     let session = await getSessionByPaymentTransaction(config, {
//       chainId: chains.base.id,
//       txHash,
//     });
 
//     // Wait for the session to complete. It can take a few seconds
//     session = await waitForSession(config, session.sessionId);
 
//     return c.res({
//       image: (
//         <div
//           style={{
//             display: "flex",
//             justifyContent: "center",
//             fontSize: 64,
//             marginTop: "200px",
//           }}
//         >
//           Mint complete!
//         </div>
//       ),
//       intents: [
//         <Button.Link
//           href={`https://explorer.zora.energy/tx/${session.sponsoredTransactionHash}`}
//         >
//           View on Zora
//         </Button.Link>,
//       ],
//     });
//   } catch (e) {
//     // If the session is not found, it means the payment is still pending.
//     // Let the user know that the payment is pending and show a button to refresh the status.
//     return c.res({
//       image: (
//         <div
//           style={{
//             display: "flex",
//             justifyContent: "center",
//             fontSize: 44,
//             marginTop: "200px",
//           }}
//         >
//           Waiting for payment confirmation..
//         </div>
//       ),
 
//       intents: [
//         <Button value={txHash} action="/tx-status">
//           Refresh
//         </Button>,
//       ],
//     });
//   }
// });


app.frame('/random-colors', async (c) => {
  const color = "#432889"
  // const color_data = await baseColors.read.getTokenAttributes([color]);

  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: color,
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
          color: 'white',
          fontSize: 60,
          fontStyle: 'normal',
          letterSpacing: '-0.025em',
          lineHeight: 1.4,
          marginTop: 0,
          padding: '0 120px',
          whiteSpace: 'pre-wrap',
        }}
      >
        <div style={{ color: 'white', display: 'flex', fontSize: 60, flexDirection: 'column', marginBottom: 60 }}>
          
          <p style={{ justifyContent: 'center', textAlign: 'center', fontSize: 32, margin: '0'}}>Successfully Minted!</p>
          <p style={{ justifyContent: 'center', textAlign: 'center', fontSize: 42, margin: '0'}}>{color} </p>
          
        </div>
      </div>
    ),
    intents: [
      <Button action='/random-colors'>Buy</Button>,
    ],
  })
})

// Uncomment for local server testing
devtools(app, { serveStatic });

export const GET = handle(app)
export const POST = handle(app)
