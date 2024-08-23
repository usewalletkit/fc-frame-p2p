import dotenv from "dotenv";
import { Frog } from "frog";
import { Icon, vars } from "../lib/ui.js";
import { neynar } from "frog/middlewares";
import { Button, TextInput } from "frog";
import { Box, Spacer, Image, Text } from "../lib/ui.js";
import { fetchUserData } from "../lib/fetchUserData.js";
import {
  chains,
  createSession,
  currencies,
  CurrencyNotSupportedError,
  getSessionById,
  updatePaymentTransaction,
} from "@paywithglide/glide-js";
import { glideConfig } from "../lib/glide.js";
import { formatUnits, hexToBigInt } from "viem";
import { parseFullName } from 'parse-full-name';
import truncate from "truncate-utf8-bytes";

dotenv.config();

export const app = new Frog({
  ui: { vars },
  title: "Pay with Glide - send tokens to anyone from any chain",
  imageAspectRatio: "1:1",
  imageOptions: {
    height: 1024,
    width: 1024,
  },
  headers: {
    "cache-control":
      "no-store, no-cache, must-revalidate, proxy-revalidate max-age=0, s-maxage=0",
  },
}).use(
  neynar({
    apiKey: process.env.NEYNAR_API_KEY || "NEYNAR_FROG_FM",
    features: ["interactor", "cast"],
  }),
);

// Function to truncate text without breaking symbols, spaces, or new lines
const truncateText = (text: string, maxLength: number) => {
  // Normalize new lines to spaces for consistent truncation
  let normalizedText = text.replace(/\n/g, ' ');

  // If text length exceeds maxLength, truncate and add ellipsis
  if ([...normalizedText].length > maxLength) {
    let truncatedText = normalizedText.slice(0, maxLength);

    // Ensure we don't cut off multi-byte characters or emojis
    while (truncatedText.length > 0 && [...truncatedText].length > maxLength) {
      truncatedText = truncatedText.slice(0, -1);
    }

    // Trim any trailing spaces after truncation and add ellipsis
    return truncatedText.trimEnd() + '...';
  }

  // If the text doesn't exceed maxLength, return it as is
  return normalizedText;
};

// Function to format number
function formatNumber(num: number) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

// URL for the public server
const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:5173";


app.frame("/", (c) => {
  return c.res({
    image: "/initial-image",
    intents: [
      <TextInput placeholder="dwr.eth or 0xc69...c758" />,
      <Button action="/review"> Continue </Button>,
    ],
  });
});

app.image("/initial-image", (c) => {
  return c.res({
    image: (
      <Box 
        grow 
        flexDirection="column" 
        gap="8"
        textAlign="left"
        height="100%"
        width="100%"
        backgroundImage={`url(${PUBLIC_URL}/images/bg.png)`}
      >
        <Box flex="1" />
        <Box
          backgroundColor="text_bg" 
          paddingLeft="26"
          paddingRight="26"
          paddingTop="48"
          paddingBottom="32"
          width="100%"
          flex="1"
        >
          <text 
            style={
              {
                border: "none",
                color: "black",
                fontSize: "80px",
                fontWeight: "500",
                width: "100%",
                resize: "none",
                outline: "none",
                lineHeight: "1"
              }
            }
          >
            Send your favorite tokens
          </text>

          <Spacer size="20" />

          <text 
            style={
              {
                border: "none",
                color: "grey",
                fontSize: "52px",
                fontWeight: "400",
                width: "100%",
                resize: "none",
                outline: "none",
              }
            }
          >
            Pay Farcasters with any token you like, and they always get ETH on Base.
          </text>
        </Box>
      </Box>
    ),
  });
});

app.frame("/review", async (c) => {
  const { inputText } = c;

  try {
    // Fetch user by username
    const byUsernameResponse = await fetch(
      `${process.env.BASE_URL_NEYNAR_V2}/user/search?q=${inputText}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          api_key: process.env.NEYNAR_API_KEY || "",
        },
      },
    );

    // Fetch user by address
    const byAddressResponse = await fetch(
      `${process.env.BASE_URL_NEYNAR_V2}/user/bulk-by-address?addresses=${inputText}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          api_key: process.env.NEYNAR_API_KEY || "",
        },
      },
    );

    // Check if at least one response is okay
    if (!byUsernameResponse.ok && !byAddressResponse.ok) {
      return c.error({
        message: "User not found!",
      });
    }

    // Parse the responses
    const dataUsername = byUsernameResponse.ok
      ? await byUsernameResponse.json()
      : null;
    const dataAddress = byAddressResponse.ok
      ? await byAddressResponse.json()
      : null;

    // Check if results are available in either response
    const username = dataUsername?.result?.users?.[0];
    const address = dataAddress
      ? (Object.values(dataAddress) as any)[0][0]
      : null;

    if (!username && !address) {
      return c.error({
        message: "User not found!",
      });
    }

    // Get the fid from either username or address
    const toFid = username?.fid || address?.fid;

    if (!toFid) {
      return c.error({
        message: "User fid not found!",
      });
    }

    // Respond with the image and intents
    return c.res({
      image: `/review-image/${toFid}`,
      intents: [
        <TextInput placeholder="0.1 eth on base or 5 usdc" />,
        <Button action={`/send/${toFid}`}> Review </Button>,
      ],
    });
  } catch (error) {
    return c.error({
      message: "An error occurred while searching for the user.",
    });
  }
});

app.image("/review-image/:toFid", async (c) => {
  const { toFid } = c.req.param();

  const user = await fetchUserData(toFid);

  const pfpUrl = user.pfp_url;

  const parsedName = parseFullName(user.display_name);

  const displayName = parsedName.first;

  const username = user.username;

  const bio = user.profile.bio.text;

  const followers = user.follower_count;

  return c.res({
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    },
    image: (
      <Box 
        grow 
        backgroundColor="bg" 
        flexDirection="column" 
        gap="8"
        paddingTop="48"
        paddingLeft="28"
        paddingRight="28"
        textAlign="left"
        height="100%"
        width="100%"
      >

        <Box backgroundColor="bg" flex="1" >
          <Box
            grow
            backgroundColor="bg"
            flex="1"
            flexDirection="row"
            alignItems="center"
            width="100%"
            overflow="hidden"
            position="relative"
          >
            {/* Image */}
            <img
              width="256"
              height="256"
              src={pfpUrl}
              style={{
                borderRadius: "20px",
                objectFit: "cover",
                maxWidth: "100%",
                maxHeight: "100%",
                display: "block",
              }}
            />
            <Spacer size="24" />
            
            {/* Text Container */}
            <Box
              display="flex"
              flexDirection="column"
              alignItems="flex-start"
              flex="1"
            >
              <Text align="left" weight="500" color="grey" size="24">
                @{username}
              </Text>
              <Spacer size="6" />
  
              <Text align="left" weight="400" color="black" size="24">
                {truncate(bio, 60) + (Buffer.byteLength(bio, 'utf8') > 60 ? '...' : '')}
              </Text>
              <Spacer size="10" />
  
              <Box
                display="flex"
                flexDirection="row"
                alignItems="center"
              >
                <Text align="left" weight="500" color="black" size="24">
                  {formatNumber(followers)}
                </Text>
                <Spacer size="6" />
                <Text align="left" color="grey" size="24">
                  Followers
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>

        <Spacer size="60" />
        
        <Box backgroundColor="bg" flex="1" >
          <Box
            backgroundColor="bg"
            display="flex"
            flexDirection="column"
          >
            <text 
              style={{
                border: "none",
                color: "black",
                fontSize: "80px",
                fontWeight: "500",
                width: "100%",
                resize: "none",
                outline: "none",
                lineHeight: "0.9"
              }}
            >
              Pay {displayName}
            </text>

            <Spacer size="10" />
  
            <text 
              style={{
                border: "none",
                color: "grey",
                fontSize: "52px",
                fontWeight: "400",
                width: "100%",
                resize: "none",
                outline: "none",
              }}
            >
              Pay with any token and they will receive ETH on Base.
            </text>
          </Box>
        </Box>

        <Box backgroundColor="bg" flex="1" > 
        <Box
            borderRadius="14"
            padding="14"
            background="blue"
            height="128"
            width="100%"
            justifyContent="center"
          >
            <Box flexDirection="row" alignItems="center" display="flex">
              <box style={{ transform: "rotate(-68.01deg)" }}>
                <Icon name="undo" color="white" size="60" />
              </box>
              <Spacer size="10" />
              <text 
                style={{
                  border: "none",
                  color: "white",
                  fontSize: "42px",
                  fontWeight: "500",
                  width: "100%",
                  resize: "none",
                  outline: "none",
                }}
              >
                Enter the amount and token you want to send
              </text>
            </Box>
          </Box>
        </Box>
      </Box>
    ),
  });
});

app.frame("/send/:toFid", async (c) => {
  const { inputText } = c;
  const { fid } = c.var.interactor || {};

  const fromFid = fid;
  const { toFid } = c.req.param();

  // Regular expression to match the input text format with optional chain
  const inputPattern = /(\d+(\.\d+)?\s+)(\w+)(?:\s+on\s+(\w+))?/i;
  const match = inputText ? inputText.match(inputPattern) : null;

  if (match) {
    const user = await fetchUserData(toFid);

    const toEthAddress = user.verified_addresses.eth_addresses
      .toString()
      .toLowerCase()
      .split(",")[0];

    console.log(`To Address: ${toEthAddress}`);

    const amount = match[1].trim();
    const currency = match[3].toLowerCase();
    const chain = match[4] ? match[4].toLowerCase() : "base"; // Default to 'base' if no chain is provided

    console.log(`Amount: ${amount}, Currency: ${currency}, Chain: ${chain}`);

    // Set the variables based on the parsed input
    const paymentAmount = amount;
    const paymentCurrency = currency;
    let parsedChain = chain;

    // Add logic to handle the chain and currency as needed
    let chainId;
    switch (parsedChain) {
      case "eth":
      case "ethereum":
      case "mainnet":
        chainId = "ethereum";
        break;
      case "base":
        chainId = "base";
        break;
      case "optimism":
      case "op":
        chainId = "optimism";
        break;
      case "arbitrum":
      case "arb":
        chainId = "arbitrum";
        break;
      case "polygon":
        chainId = "polygon";
        break;
      case "degen":
        chainId = "degen";
        break;
      case "zora":
        chainId = "zora";
        break;
      case "avax":
        chainId = "avax";
        break;
      case "blast":
        chainId = "blast";
        break;
      // Add other chains as needed
      default:
        chainId = "base";
        break;
    }

    try {
      const paymentCurrencyOnChain = (currencies as any)[paymentCurrency].on(
        (chains as any)[chainId],
      );
      if (!paymentCurrencyOnChain) {
        return c.error({
          message: "Invalid currency or chain provided. Please try again.",
        });
      }
    } catch (error) {
      if (error instanceof CurrencyNotSupportedError) {
        return c.error({
          message: "Currency not supported.",
        });
      } else {
        return c.error({
          message: "An unexpected error occurred. Please try again.",
        });
      }
    }

    const paymentCurrencyOnChain = (currencies as any)[paymentCurrency].on(
      (chains as any)[chainId],
    );

    try {
      const { sessionId, sponsoredTransaction } = await createSession(
        glideConfig,
        {
          chainId: chains.base.id,

          paymentCurrency: paymentCurrencyOnChain,
          paymentAmount: Number(paymentAmount),

          address: toEthAddress as `0x${string}`,
        },
      );

      if (!sponsoredTransaction) {
        throw new Error("missing sponsored transaction");
      }

      const displayPaymentAmount =
        Number(paymentAmount) < 0.00001
          ? "<0.00001"
          : parseFloat(Number(paymentAmount).toFixed(5)).toString();

      const ethValueInHex = sponsoredTransaction.value;

      const ethValue = formatUnits(hexToBigInt(ethValueInHex), 18);

      const displayReceivedEthValue =
        Number(ethValue) < 0.00001
          ? "<0.00001"
          : parseFloat(Number(ethValue).toFixed(5)).toString();

      const chainStr = chainId.charAt(0).toUpperCase() + chainId.slice(1);

      const paymentCurrencyUpperCase = paymentCurrency.toUpperCase();

      return c.res({
        action: `/tx-status/${sessionId}/${fromFid}/${toFid}/${displayReceivedEthValue}`,
        image: `/send-image/${toFid}/${displayPaymentAmount}/${displayReceivedEthValue}/${chainStr}/${paymentCurrencyUpperCase}`,
        intents: [
          <Button.Transaction target={`/send-tx/${sessionId}`}>
            Send
          </Button.Transaction>,
        ],
      });
    } catch (error) {
      return c.error({
        message: "Failed to create Glide session. Please try again.",
      });
    }
  } else {
    return c.error({
      message:
        'Invalid input format. Please use the format: "<number> <currency> on <chain>"',
    });
  }
});

app.image(
  "/send-image/:toFid/:displayPaymentAmount/:displayReceivedEthValue/:chainStr/:paymentCurrencyUpperCase",
  async (c) => {
    const {
      toFid,
      displayPaymentAmount,
      displayReceivedEthValue,
      chainStr,
      paymentCurrencyUpperCase,
    } = c.req.param();

    let paymentCurrencyLogoUrl;
    switch (chainStr) {
      case "Ethereum":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/ethereum/icon.png`;
        switch (paymentCurrencyUpperCase) {
          case "USDC":
            paymentCurrencyLogoUrl =
              "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=032";
            break;
          case "USDT":
            paymentCurrencyLogoUrl =
              "https://cryptologos.cc/logos/tether-usdt-logo.png?v=032";
            break;
        }
        break;
      case "Base":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/base.png`;
        switch (paymentCurrencyUpperCase) {
          case "USDC":
            paymentCurrencyLogoUrl =
              `${PUBLIC_URL}/chains/base/tokens/usdc_base.png`;
            break;
        }
        break;
      case "Optimism":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/optimism/icon.png`;
        switch (paymentCurrencyUpperCase) {
          case "USDC":
            paymentCurrencyLogoUrl =
              `${PUBLIC_URL}/chains/optimism/tokens/usdc_op.png`;
            break;
          case "ETH":
            paymentCurrencyLogoUrl =
              `${PUBLIC_URL}/chains/optimism/tokens/eth_op.png`;
            break;
        }
        break;
      case "Arbitrum":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/arbitrum/icon.png`;
        switch (paymentCurrencyUpperCase) {
          case "USDC":
            paymentCurrencyLogoUrl =
              `${PUBLIC_URL}/chains/arbitrum/tokens/usdc_arb.png`;
            break;
          case "ETH":
            paymentCurrencyLogoUrl =
              `${PUBLIC_URL}/chains/arbitrum/tokens/eth_arb.png`;
            break;
        }
        break;
      case "Polygon":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/polygon/icon.png`;
        break;
      case "Degen":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/degen/icon.png`;
        break;
      case "Zora":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/zora/icon.png`;
        break;
      case "Avax":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/avax/icon.png`;
        break;
      case "Blast":
        paymentCurrencyLogoUrl =
          `${PUBLIC_URL}/chains/blast/icon.png`;
        break;
      // Add other currencies as needed
      default:
        paymentCurrencyLogoUrl =
        `${PUBLIC_URL}/chains/base/icon.png`;
        break;
    }

    const user = await fetchUserData(toFid);

    const pfpUrl = user.pfp_url;

    const parsedName = parseFullName(user.display_name);

    const displayName = parsedName.first;

    const username = user.username;

    const bio = user.profile.bio.text;

    const followers = user.follower_count;

    return c.res({
      headers: {
        "cache-control":
          "no-store, no-cache, must-revalidate, proxy-revalidate max-age=0, s-maxage=0",
      },
      image: (
        <Box 
          grow 
          backgroundColor="bg" 
          flexDirection="column" 
          gap="8"
          paddingTop="48"
          paddingLeft="28"
          paddingRight="28"
          paddingBottom="48"
          textAlign="left"
          height="100%"
          width="100%"
        >

          <Box backgroundColor="bg" flex="1" >
            <Box
              grow
              backgroundColor="bg"
              flex="1"
              flexDirection="row"
              alignItems="center"
              width="100%"
              overflow="hidden"
              position="relative"
            >
              {/* Image */}
              <img
                width="256"
                height="256"
                src={pfpUrl}
                style={{
                  borderRadius: "20px",
                  objectFit: "cover",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  display: "block",
                }}
              />
              <Spacer size="24" />
              
              {/* Text Container */}
              <Box
                display="flex"
                flexDirection="column"
                alignItems="flex-start"
                flex="1"
              >
                <Text align="left" weight="500" color="grey" size="24">
                  @{username}
                </Text>
                <Spacer size="6" />
    
                <Text align="left" weight="400" color="black" size="24">
                  {truncate(bio, 60) + (Buffer.byteLength(bio, 'utf8') > 60 ? '...' : '')}
                </Text>
                <Spacer size="10" />
    
                <Box
                  display="flex"
                  flexDirection="row"
                  alignItems="center"
                >
                  <Text align="left" weight="500" color="black" size="24">
                    {formatNumber(followers)}
                  </Text>
                  <Spacer size="6" />
                  <Text align="left" color="grey" size="24">
                    Followers
                  </Text>
                </Box>
              </Box>
            </Box>
          </Box>

          <Spacer size="80" />
          
          <Box
            backgroundColor="bg"
            display="flex"
            flexDirection="column"
            flex="1"
          >
            <text 
              style={{
                border: "none",
                color: "black",
                fontSize: "80px",
                fontWeight: "500",
                width: "100%",
                resize: "none",
                outline: "none",
                lineHeight: "0.9"
              }}
            >
              Pay {displayName}
            </text>

            <Spacer size="10" />
  
            <text 
              style={{
                border: "none",
                color: "grey",
                fontSize: "52px",
                fontWeight: "400",
                width: "100%",
                resize: "none",
                outline: "none",
              }}
            >
              You are sending {displayPaymentAmount} {paymentCurrencyUpperCase} on{" "}{chainStr}.
            </text>
          </Box>

          {/* Transaction Summary Section */}
          <Box
            flexDirection="row"
            background="bg"
            alignItems="center"
            justifyContent="space-between"
          >
            {/* You Send Section */}
            <Box 
              backgroundColor="bg" 
              flex="2"
              alignHorizontal="left"
              padding="0"
            >
              <Text align="right" weight="600" color="grey" size="20">
                YOU SEND
              </Text>
    
              <Spacer size="8" />
  
              <Box flexDirection="row">
                <Image
                  width="28"
                  height="28"
                  objectFit="cover"
                  src={paymentCurrencyLogoUrl}
                />
                <Spacer size="8" />
                <text 
                  style={{
                    border: "none",
                    color: "black",
                    fontSize: "42px",
                    fontWeight: "500",
                    width: "100%",
                    resize: "none",
                    outline: "none",
                  }}
                >
                  {displayPaymentAmount} {paymentCurrencyUpperCase}
                </text>
              </Box>
            </Box>
      
            {/* Arrow Icon */}
            <Box
              backgroundColor="bg"
              flex="1"
              alignHorizontal="center"
              justifyContent="center"
              display="flex"
            >
              <Icon name="move-right" color="grey" size="60" />
            </Box>
      
            {/* They Receive Section */}
            <Box
              backgroundColor="bg"
              flex="2"
              alignHorizontal="right"
            >
              <Text align="right" weight="600" color="grey" size="20">
                THEY RECEIVE
              </Text>
              <Spacer size="8" />
              <Box flexDirection="row">
                <Image
                  width="28"
                  height="28"
                  objectFit="cover"
                  src={`${PUBLIC_URL}/chains/base/tokens/eth_base.png`}
                />
                <Spacer size="8" />
                <text 
                  style={{
                    border: "none",
                    color: "black",
                    fontSize: "42px",
                    fontWeight: "500",
                    textAlign: "right",
                  }}
                >
                  {displayReceivedEthValue} ETH
                </text>
              </Box>
            </Box>
          </Box>
        </Box>
      ),    
    });
  },
);

app.transaction(
  "/send-tx/:sessionId",
  async (c, next) => {
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

    const { unsignedTransaction } = await getSessionById(
      glideConfig,
      sessionId,
    );

    if (!unsignedTransaction) {
      throw new Error("missing unsigned transaction");
    }

    return c.send({
      chainId: unsignedTransaction.chainId as any,
      to: unsignedTransaction.to || undefined,
      data: unsignedTransaction.input || undefined,
      value: hexToBigInt(unsignedTransaction.value),
    });
  },
);

app.frame(
  "/tx-status/:sessionId/:fromFid/:toFid/:displayReceivedEthValue",
  async (c) => {
    const { transactionId, buttonValue } = c;

    const {
      sessionId,
      fromFid,
      toFid,
      displayReceivedEthValue,
    } = c.req.param();

    // The payment transaction hash is passed with transactionId if the user just completed the payment. If the user hit the "Refresh" button, the transaction hash is passed with buttonValue.
    const txHash = transactionId || buttonValue;

    if (!txHash) {
      return c.error({
        message: "Missing transaction hash, please try again.",
      });
    }

    try {
      // Check if the session is already completed
      const { success } = await updatePaymentTransaction(glideConfig, {
        sessionId: sessionId,
        hash: txHash as `0x${string}`,
      });

      if (!success) {
        throw new Error("failed to update payment transaction");
      }

      // Get the current session state
      const session = await getSessionById(glideConfig, sessionId);

      if (!session) {
        throw new Error("Session not found");
      }

      // If the session has a sponsoredTransactionHash, it means the transaction is complete
      if (session.sponsoredTransactionHash) {
        return c.res({
          image: `/tx-success/${fromFid}/${toFid}/${displayReceivedEthValue}`,
          intents: [
            <Button.Link
              href={`https://basescan.org/tx/${session.sponsoredTransactionHash}`}
            >
              View on Explorer
            </Button.Link>,
          ],
        });
      } else {
        // If the session does not have a sponsoredTransactionHash, the payment is still pending
        return c.res({
          image: `/tx-processing/${fromFid}/${toFid}/${displayReceivedEthValue}`,
          intents: [
            <Button
              value={txHash}
              action={`/tx-status/${sessionId}/${fromFid}/${toFid}/${displayReceivedEthValue}`}
            >
              Refresh
            </Button>,
          ],
        });
      }
    } catch (e) {
      console.error("Error:", e);

      return c.res({
        image: `/tx-processing/${fromFid}/${toFid}/${displayReceivedEthValue}`,
        intents: [
          <Button
            value={txHash}
            action={`/tx-status/${sessionId}/${fromFid}/${toFid}/${displayReceivedEthValue}`}
          >
            Refresh
          </Button>,
        ],
      });
    }
  },
);


app.image(
  "/tx-processing/:fromFid/:toFid/:displayReceivedEthValue",
  async (c) => {
    const {
      fromFid,
      toFid,
      displayReceivedEthValue,
    } = c.req.param();

    const [fromUser, toUser] = await Promise.all([
      fetchUserData(fromFid),
      fetchUserData(toFid),
    ]);

    const fromPfpUrl = fromUser.pfp_url;
    const toPfpUrl = toUser.pfp_url;

    const parsedName = parseFullName(toUser.display_name);
    const toDisplayName = parsedName.first;

    return c.res({
      image: (
        <Box
          grow
          alignHorizontal="center"
          backgroundColor="bg"
          paddingBottom="48"
          textAlign="center"
          height="100%"
          width="100%"
        >

          <Box
            grow
            backgroundColor="green"
            position="relative"
            display="flex"
            justifyContent="center"
            alignHorizontal="center"
            marginLeft="10"
          >
            <Box
              position="absolute"
              display="flex"
              justifyContent="center"
              backgroundColor="green"
              marginTop="160"
            >
              <img
                height="256"
                width="256"
                src={fromPfpUrl}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  position: "absolute",
                  right: 0,
                }}
              />

              <img
                height="256"
                width="256"
                src={toPfpUrl}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  position: "absolute",
                  left: "-30px",
                }}
              />
            </Box>
          </Box>

          <text 
            style={{
              color: "black",
              fontSize: "80px",
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            Sent!
          </text>

          <Spacer size="10" />
          
          <Box
            paddingLeft="192"
            paddingRight="192"
          >
            <text 
              style={{
                color: "grey",
                fontSize: "42px",
                fontWeight: "400",
                textAlign: "center",
              }}
            >
              {toDisplayName} will receive {displayReceivedEthValue} ETH on Base.
            </text>
          </Box>

          <Spacer size="96" />

          <Text align="center" weight="600" color="grey" size="20">
            STATUS
          </Text>

          <Spacer size="10" />

          <Box
            flexDirection="row"
            alignItems="flex-start"
            justifyContent="center"
          >
            <Icon name="clock" color="process" size="30" />
            <Spacer size="6" />
            <text 
              style={{
                color: "black",
                fontSize: "42px",
                fontWeight: "500",
                textAlign: "center",
              }}
            >
              In progress
            </text>
          </Box>
        </Box>
      ),
    });
  },
);


app.image(
  "/tx-success/:fromFid/:toFid/:displayReceivedEthValue",
  async (c) => {
    const {
      fromFid,
      toFid,
      displayReceivedEthValue,
    } = c.req.param();

    const [fromUser, toUser] = await Promise.all([
      fetchUserData(fromFid),
      fetchUserData(toFid),
    ]);

    const fromPfpUrl = fromUser.pfp_url;
    const toPfpUrl = toUser.pfp_url;

    const parsedName = parseFullName(toUser.display_name);
    const toDisplayName = parsedName.first;

    return c.res({
      image: (
        <Box
          grow
          alignHorizontal="center"
          backgroundColor="bg"
          paddingBottom="48"
          textAlign="center"
          height="100%"
          width="100%"
        >

          <Box
            grow
            backgroundColor="green"
            position="relative"
            display="flex"
            justifyContent="center"
            alignHorizontal="center"
            marginLeft="10"
          >
            <Box
              position="absolute"
              display="flex"
              justifyContent="center"
              backgroundColor="green"
              marginTop="160"
            >
              <img
                height="256"
                width="256"
                src={fromPfpUrl}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  position: "absolute",
                  right: 0,
                }}
              />

              <img
                height="256"
                width="256"
                src={toPfpUrl}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  position: "absolute",
                  left: "-30px",
                }}
              />
            </Box>
          </Box>

          <text 
            style={{
              color: "black",
              fontSize: "80px",
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            Sent!
          </text>

          <Spacer size="10" />
          
          <Box
            paddingLeft="192"
            paddingRight="192"
          >
            <text 
              style={{
                color: "grey",
                fontSize: "42px",
                fontWeight: "400",
                textAlign: "center",
              }}
            >
              {toDisplayName} will receive {displayReceivedEthValue} ETH on Base.
            </text>
          </Box>

          <Spacer size="96" />

          <Text align="center" weight="600" color="grey" size="20">
            STATUS
          </Text>

          <Spacer size="10" />

          <Box
            flexDirection="row"
            alignItems="flex-start"
            justifyContent="center"
          >
            <Icon name="circle-check" color="green" size="30" />
            <Spacer size="6" />
            <text 
              style={{
                color: "black",
                fontSize: "42px",
                fontWeight: "500",
                textAlign: "center",
              }}
            >
              Success
            </text>
          </Box>
        </Box>
      ),
    });
  },
);


if (typeof Bun !== "undefined") {
  app.use("/*", (await import("hono/bun")).serveStatic({ root: "./public" }));
  Bun.serve({
    fetch: app.fetch,
    port: 3000,
  });
  console.log("Server is running on port 3000");
}