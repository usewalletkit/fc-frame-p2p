// app/api/[[...routes]]/route.js

/** @jsxImportSource frog/jsx */
import { Button, Frog } from "frog";
import { handle } from "frog/next";
import { abi } from "@/lib/constants";
import { base } from "thirdweb/chains";
import { createThirdwebClient, readContract, waitForReceipt } from "thirdweb";
import axios from "axios";
import { contract } from "@/lib/utils";
import { init, fetchQuery } from "@airstack/node";
import { contractAddress } from "@/lib/constants";
import { createGlideClient, Chains, CurrenciesByChain } from "@paywithglide/glide-js";
import { encodeFunctionData, hexToBigInt, toHex } from 'viem';
init(process.env.AIRSTACK_API_KEY, "prod");

const query = `query ResolveFarcasterProfileName($_eq: Address, $_eq1: SocialDappName, $blockchain: Blockchain!) {
  Socials(
    input: {filter: {userAssociatedAddresses: {_eq: $_eq}, dappName: {_eq: $_eq1}}, blockchain: $blockchain}
  ) {
    Social {
      dappName
      profileName
    }
  }
}`;

const fetchTopCollectors = async () => {
  const options = {
    method: "GET",
    url: "https://api.simplehash.com/api/v0/nfts/top_collectors/base/0x7bc1c072742d8391817eb4eb2317f98dc72c61db?limit=10",
    headers: {
      accept: "application/json",
      "X-API-KEY": process.env.SIMPLEHASHAPIKEY,
    },
  };

  try {
    const response = await axios.request(options);
    const topCollectors = response.data.top_collectors;

    const fetchProfileName = async (address) => {
      const variables = {
        _eq: address,
        _eq1: "farcaster",
        blockchain: "ethereum",
      };

      try {
        const { data } = await fetchQuery(query, variables);
        return data.Socials?.Social[0]?.profileName || null;
      } catch (error) {
        return null;
      }
    };

    const modifiedCollectors = await Promise.all(
      topCollectors.map(async (collector) => {
        const profileName = await fetchProfileName(collector.owner_address);
        const name = profileName
          ? profileName
          : collector.owner_ens_name
          ? collector.owner_ens_name
          : `${collector.owner_address?.slice(
              0,
              6
            )}....${collector.owner_address?.slice(-4)}`;

        return {
          name,
          balance: collector.total_copies_owned,
        };
      })
    );

    return modifiedCollectors;
  } catch (error) {
    console.error(error);
  }
};

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SCRERET_KEY,
});

function hexToAscii(hex) {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substr(i, 2), 16);
    if (charCode) {
      str += String.fromCharCode(charCode);
    }
  }
  return str;
}

function decodeHexData(hexData) {
  if (hexData.startsWith("0x")) {
    hexData = hexData.slice(2);
  }

  const segments = [];
  for (let i = 0; i < hexData.length; i += 64) {
    segments.push(hexData.slice(i, i + 64));
  }

  const length1 = parseInt(segments[2], 16);

  const data1Hex = segments[3].slice(0, length1 * 2);

  const data1 = hexToAscii(data1Hex);

  return {
    data1,
  };
}

export const glideClient = createGlideClient({
    projectId: process.env.GLIDE_PROJECT_ID,
   
    // Lists the chains where payments will be accepted
    chains: [Chains.Base],
});


export const app = new Frog({
  basePath: "/api",
  browserLocation: "/"
});

const generateRandomColor = () => {
  return (
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")
  );
};

app.frame("/", (c) => {
  return c.res({
    title: "Base Colors",
    action: "/finish",
    image: "/base-colors-x-degen.jpeg",
    imageAspectRatio: "1:1",
    imageOptions: { width: 300, height: 300 },
    intents: [
      <Button.Transaction target="/mint">Mint color</Button.Transaction>,
    ],
  });
});

app.transaction("/mint", async (c) => {
  const { address } = c;
  const hex = generateRandomColor();
  console.log(hex);

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
        args: [hex, hex.substring(1), address],
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

app.frame("/finish", async (c) => {
  const { transactionId } = c;
  const receipt = await waitForReceipt({
    client,
    chain: base,
    transactionHash: transactionId,
  });

  const address = receipt.from;
  const decodedHexData = decodeHexData(receipt.logs[1].data);
  const hex = decodedHexData.data1;
  return c.res({
    image: (
      <div
        style={{
          height: "600px",
          width: "600px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f3f3f3",
        }}
      >
        <div
          style={{
            height: "580px",
            width: "600px",
            display: "flex",
            justifyContent: "center",
            backgroundColor: hex,
          }}
        ></div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            marginTop: "-10",
            gap: "400px",
          }}
        >
          <p style={{ fontSize: 20 }}>Minted!</p>
          <p style={{ fontSize: 20, textTransform: "uppercase" }}>{hex}</p>
        </div>
      </div>
    ),
    imageAspectRatio: "1:1",
    imageOptions: { width: 600, height: 600 },
    intents: [
      <Button.Transaction action="/finish" target="/mint">
        Mint +1
      </Button.Transaction>,
      <Button.Transaction
        action={`/leaderBoard/${address}`}
        target="/mintBatch"
      >
        Mint +10
      </Button.Transaction>,
      <Button.Link
        href={`https://warpcast.com/~/compose?text=%2Fbasecolors%0A%0A%5BNote%3A%20a%20square%20image%20of%20your%20color%20will%20automatically%20appear%20in%20this%20cast.%20Please%20delete%20this%20note%20before%20casting%20and%20click%20the%20channel%20to%20cast%20in%20%2Fbasecolors.%5D
&embeds[]=https://hexcolorserver.replit.app/${hex.substring(
          1
        )}.png&embeds[]=https://warpcast.com/jake/0xb4da666b`}
      >
        Share
      </Button.Link>,
      <Button.Link
        href={`https://basecolors.com?addressFromFrame=${address}`}
      >
        Name it
      </Button.Link>,
    ],
  });
});

app.transaction("/mintBatch", async (c) => {
  const { address } = c;
  const hexs = Array.from({ length: 10 }, generateRandomColor);
  console.log(hexs);

  const { unsignedTransaction } = await glideClient.createSession( {
    payerWalletAddress: address,
 
    paymentCurrency: CurrenciesByChain.BaseMainnet.DEGEN,

    transaction: {
      chainId: Chains.Base.caip2,
      to: contractAddress,
      value: toHex(BigInt(1000000000000000n) * BigInt(10)),
      input: encodeFunctionData({
        abi: abi,
        functionName: "mintBatch",
        args: [hexs, hexs.map((hex) => hex.substring(1)), 10, address],
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

app.frame("/leaderBoard/:address", async (c) => {
  // const address = await fetchUser(transactionId);
  const address = c.req.param("address");
  console.log(address);
  const data = await readContract({
    contract,
    method: "function balanceOf(address owner) view returns (uint256)",
    params: [address],
  });
  console.log(address);
  const userBalance = data.toString();
  console.log(userBalance);
  const leaderBoard = await fetchTopCollectors();
  console.log(leaderBoard);

  return c.res({
    image: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 20,
          width: "600px",
          backgroundColor: "#ffffff",
          height: "600px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 40,
            marginBottom: 12.5,
            fontWeight: 700,
            textDecoration: "underline",
          }}
        >
          Leaderboard
        </div>
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              width: 100,
              height: 37.5,
              border: "1px solid black",
              justifyContent: "center",
            }}
          >
            <p style={{ marginTop: 6.25 }}>Rank</p>
          </div>
          <div
            style={{
              width: 300,
              height: 37.5,
              border: "1px solid black",
              padding: 7.5,
            }}
          >
            Name
          </div>
          <div
            style={{
              width: 100,
              height: 37.5,
              border: "1px solid black",
              padding: 7.5,
            }}
          >
            Balance
          </div>
        </div>
        {leaderBoard.map((item, index) => (
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                width: 100,
                height: 37.5,
                border: "1px solid black",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              #{index + 1}
            </div>
            <div
              style={{
                display: "flex",
                width: 300,
                height: 37.5,
                border: "1px solid black",
                padding: 7.5,
              }}
            >
              {item.name}
            </div>
            <div
              style={{
                display: "flex",
                width: 100,
                height: 37.5,
                border: "1px solid black",
                padding: 7.5,
              }}
            >
              {item.balance}
            </div>
          </div>
        ))}
        <p>Your Balance (COLORS) = {userBalance}</p>
      </div>
    ),
    imageAspectRatio: "1:1",
    imageOptions: { width: 600, height: 600 },
    intents: [
      <Button.Transaction
        action={`/leaderBoard/${address}`}
        target="/mintBatch"
      >
        Mint +10
      </Button.Transaction>,
      <Button.Link
        href={`https://warpcast.com/~/compose?text=%2Fbasecolors%0A%0A%5BNote%3A%20a%20square%20image%20of%20the%20Base%20Colors%20logo%20will%20automatically%20appear%20in%20this%20cast.%20Please%20delete%20this%20note%20before%20casting%20and%20click%20the%20channel%20to%20cast%20in%20%2Fbasecolors.%5D&embeds[]=https://i.ibb.co/PtwcHP7/base-spectrum-square.jpg&embeds[]=https://warpcast.com/jake/0xb4da666b`}
      >
        Share
      </Button.Link>,
      <Button.Link
        href={`https://basecolors.com?addressFromFrame=${address}`}
      >
        Name Colors
      </Button.Link>,
      <Button action={`/leaderBoard/${address}`}>Refresh</Button>,
    ],
  });
});

export const GET = handle(app);
export const POST = handle(app);