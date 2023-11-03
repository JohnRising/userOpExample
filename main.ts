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

const rpcUrl ="https://public.stackup.sh/api/v1/node/ethereum-sepolia";
const paymasterUrl = ""; // Optional - you can get one at https://app.stackup.sh/

async function main() {
  const paymasterContext = { type: "payg" };
  const paymasterMiddleware = Presets.Middleware.verifyingPaymaster(
    paymasterUrl,
    paymasterContext
  );
  const opts = paymasterUrl === "" ? {} : {
    paymasterMiddleware: paymasterMiddleware,
  }

  // Initialize the account
  const signingKey = "0x4337433743374337433743374337433743374337433743374337433743374337";
  const signer = new ethers.Wallet(signingKey);
  var builder = await Presets.Builder.SimpleAccount.init(signer, rpcUrl, opts);
  const address = builder.getSender();
  console.log(`Account address: ${address}`);

  // Create the call data
  const to = address; // Receiving address, in this case we will send it to ourselves
  const token = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B"; // Address of the ERC-20 token
  const value = "0"; // Amount of the ERC-20 token to transfer

  // Read the ERC-20 token contract
  const ERC20_ABI = require("./erc20Abi.json"); // ERC-20 ABI in json format
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const erc20 = new ethers.Contract(token, ERC20_ABI, provider);
  const decimals = await Promise.all([erc20.decimals()]);
  const amount = ethers.utils.parseUnits(value, decimals);

  // Encode the calls
  const callTo = [token, token];
  const callData = [erc20.interface.encodeFunctionData("approve", [to, amount]),
                    erc20.interface.encodeFunctionData("transfer", [to, amount])]

  // Send the User Operation to the ERC-4337 mempool
  const client = await Client.init(rpcUrl);
  const res = await client.sendUserOperation(builder.executeBatch(callTo, callData), {
    onBuild: (op) => console.log("Signed UserOperation:", op),
  });

  // Return receipt
  console.log(`UserOpHash: ${res.userOpHash}`);
  console.log("Waiting for transaction...");
  const ev = await res.wait();
  console.log(`Transaction hash: ${ev?.transactionHash ?? null}`);
  console.log(`View here: https://jiffyscan.xyz/userOpHash/${res.userOpHash}`);

}

main().catch((err) => console.error("Error:", err));