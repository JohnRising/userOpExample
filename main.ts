// Welcome to the ERC-4337 tutorial #1!
// This tutorial walks you though a simple ERC-4337 transaction: sending a User Operation
// with gas paid by a Paymaster.
//
// You can view more information about this tutorial at
// https://docs.stackup.sh/docs/get-started-with-stackup
//
// Enter `npm run dev` into your terminal to run.

// This example uses the userop.js library to build the transaction, but you can use any
// library.
import { ethers } from "ethers";
import { Presets, Client } from "userop";

const signingKey = "0x4337433743374337433743374337433743374337433743374337433743374337";
const rpcUrl ="https://public.stackup.sh/api/v1/node/ethereum-sepolia";
const paymasterUrl = ""; // Optional

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
    data: erc20.interface.encodeFunctionData("approve", [to, amount]),
  };

  const send = {
    to: token,
    data: erc20.interface.encodeFunctionData("transfer", [to, amount]),
  };

  const callTargets = [approve.to, send.to];
  const callData = [approve.data, send.data];

  return [callTargets, callData];
}

async function main() {
  const paymasterContext = { type: "payg" };
  const paymasterMiddleware = Presets.Middleware.verifyingPaymaster(
    paymasterUrl,
    paymasterContext
  );

  // Initialize the User Operation
  const signer = new ethers.Wallet(signingKey);
  const opts = paymasterUrl === "" ? {} : {
    paymasterMiddleware: paymasterMiddleware,
  }
  var builder = await Presets.Builder.SimpleAccount.init(signer, rpcUrl, opts);
  const address = builder.getSender();
  console.log(`Account address: ${address}`);

  // Create the call data
  const to = address;
  const token = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B";
  const value = "0";
  const [callTargets, callData] = await approveAndSendToken(to, token, value);

  // Send the User Operation to the ERC-4337 mempool
  const client = await Client.init(rpcUrl);
  const res = await client.sendUserOperation(builder.executeBatch(callTargets, callData), {
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
  console.log(`View here: https://jiffyscan.xyz/userOpHash/${res.userOpHash}`);
}

main().catch((err) => console.error("Error:", err));
