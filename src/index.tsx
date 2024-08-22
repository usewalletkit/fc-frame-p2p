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

// Uncomment this packages to tested on local server
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'

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

// Function to truncate text
const truncateText = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + '...';
  }
  return text;
};

// Function to format number
function formatNumber(num: number) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};


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
        alignVertical="center"
        backgroundColor="bg"
        padding="48"
        textAlign="left"
        height="100%"
        width="100%"
      >
        <Box 
          grow 
          backgroundImage="url(https://s3-alpha-sig.figma.com/img/c2ca/2452/3601c6e757fc38f6cdab466afe5a7422?Expires=1725235200&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=Au63Mt8dE2Oe2lSI-ss974mRk1ddK~LoRizIt~vDCv69j~uCJs6gSGGyS7DJKwvpDNxccO5VoLa~m1vUYp8fYvJ1AWjoZOZo-~hcWT0ut55mOriAwvhYwvM~GX0Uikh8T1r103NLQWn4J4Ue2hCxpJGMFxuDlhnSCgPPEy2ritA6cILoCH54xQ6J3LlgcPP59hrv-IYMocRJOBjxRkUiLfktQhDFsOGXRviqmmLWVQCYaFAg7-n3WeVEVoArQLt0IH7qtgwvtBTaSm7LC9sirvhLa5prQeoaI9ibRWDHbLshcLm7lv~xBTokHYHEOiWx2tbZLf-xf7HmSBgHZSsasg__)"
          borderRadius="18"
          flexDirection="column" 
          justifyContent="flex-end" 
        >
          <Box
            backgroundColor="text_bg" 
            padding="20"
            width="100%"
            height="256"
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

            <Spacer size="10" />

            <text 
              style={
                {
                  border: "none",
                  color: "grey",
                  fontSize: "42px",
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
        alignVertical="center"
        backgroundColor="bg"
        padding="48"
        textAlign="left"
        height="100%"
        width="100%"
      >
        <Box grow flexDirection="column" padding="20" gap="8" alignItems="center">
          
          {/* Text and Image Section */}
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
                {truncateText(bio, 25)}
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

          <Spacer size="60" />
  
          {/* Additional Section */}
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
                fontSize: "42px",
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
        action: `/tx-status/${sessionId}/${fromFid}/${toFid}/${displayPaymentAmount}/${displayReceivedEthValue}/${paymentCurrencyUpperCase}`,
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
          "https://cryptologos.cc/logos/ethereum-eth-logo.png?v=032";
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
          "https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.png";
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
      case "Optimism":
        paymentCurrencyLogoUrl =
          "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png?v=032";
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
      case "Arbitrum":
        paymentCurrencyLogoUrl =
          "https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=032";
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
      case "Polygon":
        paymentCurrencyLogoUrl =
          "https://cryptologos.cc/logos/polygon-matic-logo.png?v=032";
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
      // Add other currencies as needed
      default:
        paymentCurrencyLogoUrl =
          "https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.png";
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
          alignVertical="center"
          backgroundColor="bg"
          padding="48"
          textAlign="left"
          height="100%"
          width="100%"
        >
          <Box grow flexDirection="column" padding="20" gap="8" alignItems="center">
            
            {/* Text and Image Section */}
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
                  {truncateText(bio, 25)}
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
      
            <Spacer size="60" />
        
            {/* Payment Details Section */}
            <Box
              backgroundColor="bg"
              display="flex"
              flexDirection="column"
              padding="0"
              width="100%"
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
                  fontSize: "44px",
                  fontWeight: "400",
                  width: "100%",
                  resize: "none",
                  outline: "none",
                }}
              >
                You are sending {displayPaymentAmount} {paymentCurrencyUpperCase} on{" "}{chainStr}.
              </text>
            </Box>
          </Box>
        
          {/* Transaction Summary Section */}
          <Box
            flexDirection="row"
            background="bg"
            paddingLeft="20"
            paddingRight="20"
            borderRadius="14"
            alignItems="center"
            justifyContent="space-between"
          >
            {/* You Send Section */}
            <Box 
              backgroundColor="bg" 
              flex="2"
              alignHorizontal="left"
            >
              <Text align="right" weight="600" color="grey" size="20">
                YOU SEND
              </Text>
    
              <Spacer size="8" />
  
              <Box flexDirection="row">
                <Image
                  width="26"
                  height="26"
                  objectFit="cover"
                  src={paymentCurrencyLogoUrl}
                />
                <Spacer size="8" />
                <Text align="center" weight="500" color="black" size="24">
                  {displayPaymentAmount} {paymentCurrencyUpperCase}
                </Text>
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
                  width="26"
                  height="26"
                  objectFit="cover"
                  src="https://cryptologos.cc/logos/ethereum-eth-logo.png?v=032"
                />
                <Spacer size="8" />
                <Text align="right" weight="500" color="black" size="24">
                  {displayReceivedEthValue} ETH
                </Text>
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
  "/tx-status/:sessionId/:fromFid/:toFid/:displayPaymentAmount/:displayReceivedEthValue/:paymentCurrencyUpperCase",
  async (c) => {
    const { transactionId, buttonValue } = c;

    const {
      sessionId,
      fromFid,
      toFid,
      displayPaymentAmount,
      displayReceivedEthValue,
      paymentCurrencyUpperCase,
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
          image: `/tx-success/${fromFid}/${toFid}/${displayPaymentAmount}/${displayReceivedEthValue}/${paymentCurrencyUpperCase}`,
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
          image: `/tx-processing/${fromFid}/${toFid}/${displayPaymentAmount}/${displayReceivedEthValue}/${paymentCurrencyUpperCase}`,
          intents: [
            <Button
              value={txHash}
              action={`/tx-status/${sessionId}/${fromFid}/${toFid}/${displayPaymentAmount}/${displayReceivedEthValue}/${paymentCurrencyUpperCase}`}
            >
              Refresh
            </Button>,
          ],
        });
      }
    } catch (e) {
      console.error("Error:", e);

      return c.res({
        image: `/tx-processing/${fromFid}/${toFid}/${displayPaymentAmount}/${displayReceivedEthValue}/${paymentCurrencyUpperCase}`,
        intents: [
          <Button
            value={txHash}
            action={`/tx-status/${sessionId}/${fromFid}/${toFid}/${displayPaymentAmount}/${displayReceivedEthValue}/${paymentCurrencyUpperCase}`}
          >
            Refresh
          </Button>,
        ],
      });
    }
  },
);

app.image(
  "/tx-processing/:fromFid/:toFid/:displayPaymentAmount/:displayReceivedEthValue/:paymentCurrencyUpperCase",
  async (c) => {
    const {
      fromFid,
      toFid,
      displayPaymentAmount,
      displayReceivedEthValue,
      paymentCurrencyUpperCase,
    } = c.req.param();

    const [fromUser, toUser] = await Promise.all([
      fetchUserData(fromFid),
      fetchUserData(toFid),
    ]);

    const fromPfpUrl = fromUser.pfp_url;
    const toPfpUrl = toUser.pfp_url;
    const toDisplayName = toUser.display_name;

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
          <Image height="28" objectFit="cover" src="/images/primary.png" />

          <Box
            backgroundColor="bg"
            position="relative"
            display="flex"
            justifyContent="center"
            alignHorizontal="center"
            marginTop="20"
            marginLeft="10"
          >
            <Box
              position="absolute"
              display="flex"
              justifyContent="center"
              backgroundColor="green"
            >
              <img
                height="96"
                width="96"
                src={fromPfpUrl}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  position: "absolute",
                  right: 0,
                }}
              />

              <img
                height="96"
                width="96"
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

          <Spacer size="32" />

          <Text align="center" color="black" weight="600" size="24">
            Sent!
          </Text>

          <Spacer size="6" />

          <Text align="center" color="grey" weight="600" size="14">
            {displayPaymentAmount} {paymentCurrencyUpperCase}
          </Text>

          <Spacer size="16" />

          <Text align="center" weight="400" color="grey" size="16">
            Your transaction is underway.
          </Text>

          <Spacer size="6" />

          <Text align="center" weight="400" color="grey" size="16">
            {toDisplayName} will receive {displayReceivedEthValue} ETH on Base
            shortly.
          </Text>

          <Spacer size="32" />

          <Text align="center" weight="600" color="grey" size="14">
            STATUS
          </Text>

          <Spacer size="16" />

          <Box
            flexDirection="row"
            alignItems="flex-start"
            justifyContent="center"
          >
            <Icon name="clock" color="process" size="22" />
            <Spacer size="6" />
            <Text align="center" weight="600" color="black" size="20">
              Processing
            </Text>
          </Box>
        </Box>
      ),
    });
  },
);

app.image(
  "/tx-success/:fromFid/:toFid/:displayPaymentAmount/:displayReceivedEthValue/:paymentCurrencyUpperCase",
  async (c) => {
    const {
      fromFid,
      toFid,
      displayPaymentAmount,
      displayReceivedEthValue,
      paymentCurrencyUpperCase,
    } = c.req.param();

    const [fromUser, toUser] = await Promise.all([
      fetchUserData(fromFid),
      fetchUserData(toFid),
    ]);

    const fromPfpUrl = fromUser.pfp_url;
    const toPfpUrl = toUser.pfp_url;
    const toDisplayName = toUser.display_name;

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
          <Image height="28" objectFit="cover" src="/images/primary.png" />

          <Box
            backgroundColor="bg"
            position="relative"
            display="flex"
            justifyContent="center"
            alignHorizontal="center"
            marginTop="20"
            marginLeft="10"
          >
            <Box
              position="absolute"
              display="flex"
              justifyContent="center"
              backgroundColor="green"
            >
              <img
                height="96"
                width="96"
                src={fromPfpUrl}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  position: "absolute",
                  right: 0,
                }}
              />

              <img
                height="96"
                width="96"
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

          <Spacer size="32" />

          <Text align="center" color="black" weight="600" size="24">
            Sent!
          </Text>

          <Spacer size="6" />

          <Text align="center" color="grey" weight="600" size="14">
            {displayPaymentAmount} {paymentCurrencyUpperCase}
          </Text>

          <Spacer size="16" />

          <Text align="center" weight="400" color="grey" size="16">
            Your transaction is underway.
          </Text>

          <Spacer size="6" />

          <Text align="center" weight="400" color="grey" size="16">
            {toDisplayName} will receive {displayReceivedEthValue} ETH on Base
            shortly.
          </Text>

          <Spacer size="32" />

          <Text align="center" weight="600" color="grey" size="14">
            STATUS
          </Text>

          <Spacer size="16" />

          <Box
            flexDirection="row"
            alignItems="flex-start"
            justifyContent="center"
          >
            <Icon name="circle-check" color="green" size="22" />
            <Spacer size="6" />
            <Text align="center" weight="600" color="black" size="20">
              Success
            </Text>
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


// Uncomment for local server testing
devtools(app, { serveStatic });