// Welcome to the ERC-4337 tutorial #1!
// This tutorial walks you though a simple ERC-4337 transaction: sending a User Operation
// with gas paid by a Paymaster.
//
// You can view more information about this tutorial at
// https://docs.stackup.sh/docs/get-started-with-stackup
//
// Enter `npx ts-node main.ts` into your terminal to run.

// This example uses the userop.js library to build the transaction, but you can use any
// library.
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { Presets, Client } from "userop";

// DO THIS FIRST
//
// Copy the example environment file `.env.example` to `.env` and add the variables.
// You can get a free API key at https://app.stackup.sh/, but any ERC-4337 bundler or
// paymaster service should work.
dotenv.config();
const signingKey = process.env.SIGNING_KEY || "";
const rpcUrl = process.env.RPC_URL || "";
const paymasterUrl = process.env.PAYMASTER_URL || "";

// This function creates the call data that will be executed. This combines the approval
// and send call in a single transaction. You can add as many contract calls as you want
// in a User Operation.
async function approveAndSendToken(
  to: string,
  token: string,
  value: string
): Promise<any[]> {
  const ERC20_ABI = require("./erc20Abi.json");
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const erc20 = new ethers.Contract(token, ERC20_ABI, provider);
  const decimals = await Promise.all([erc20.decimals()]);
  const amount = ethers.utils.parseUnits(value, decimals);

  const approve = {
    to: token,
    value: ethers.constants.Zero,
    data: erc20.interface.encodeFunctionData("approve", [to, amount]),
  };

  const send = {
    to: token,
    value: ethers.constants.Zero,
    data: erc20.interface.encodeFunctionData("transfer", [to, amount]),
  };

  return [approve, send];
}

// This function builds the User Operation and sends it to the blockchain via the ERC-4337
// bundler network.
async function main() {
  // Define the kind of paymaster you want to use. If you do not want to use a paymaster,
  // comment out these lines.
  const paymasterContext = { type: "payg" };
  const paymasterMiddleware = Presets.Middleware.verifyingPaymaster(
    paymasterUrl,
    paymasterContext
  );

  // Initialize the User Operation
  // Userop.js has a few presets for different smart account types to set default fields
  // for user operations. This uses the ZeroDev Kernel contracts.
  const signer = new ethers.Wallet(signingKey);
  var builder = await Presets.Builder.Kernel.init(signer, rpcUrl, {
    paymasterMiddleware: paymasterMiddleware,
  });
  const address = builder.getSender();
  console.log(`Account address: ${address}`);

  // Create the call data
  const to = address;
  const token = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B";
  const value = "0";
  const calls = await approveAndSendToken(to, token, value);

  // Send the User Operaiton to the ERC-4337 mempool
  const client = await Client.init(rpcUrl);
  const res = await client.sendUserOperation(builder.executeBatch(calls), {
    onBuild: (op) => console.log("Signed UserOperation:", op),
  });

  // Print the results!
  // If you encounter any errors, search the FAQ at https://docs.stackup.sh/docs/faq or
  // contact us in Discord at https://discord.com/invite/FpXmvKrNed or
  // email us at support@stackup.sh
  console.log(`UserOpHash: ${res.userOpHash}`);
  console.log("Waiting for transaction...");
  const ev = await res.wait();
  console.log(`Transaction hash: ${ev?.transactionHash ?? null}`);
}

main().catch((err) => console.error("Error:", err));
