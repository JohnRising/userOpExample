import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { Presets, Client } from "userop";

dotenv.config();
const signingKey = process.env.SIGNING_KEY || "";
const rpcUrl = process.env.RPC_URL || "";
const paymasterUrl = process.env.PAYMASTER_URL || "";

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

async function main() {
  // Paymaster
  const paymasterContext = { type: "payg" };
  const paymasterMiddleware = Presets.Middleware.verifyingPaymaster(
    paymasterUrl,
    paymasterContext
  );

  // Initialize userop builder
  const signer = new ethers.Wallet(signingKey);
  var builder = await Presets.Builder.Kernel.init(signer, rpcUrl, {
    paymasterMiddleware: paymasterMiddleware,
  });
  const address = builder.getSender();
  console.log(`Account address: ${address}`);

  // Approve and send token
  const to = address;
  const token = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B";
  const value = "0";
  const calls = await approveAndSendToken(to, token, value);

  // Build & send
  const client = await Client.init(rpcUrl);
  const res = await client.sendUserOperation(builder.executeBatch(calls), {
    onBuild: (op) => console.log("Signed UserOperation:", op),
  });

  console.log(`UserOpHash: ${res.userOpHash}`);
  console.log("Waiting for transaction...");
  const ev = await res.wait();
  console.log(`Transaction hash: ${ev?.transactionHash ?? null}`);
}

main().catch((err) => console.error("Error:", err));
