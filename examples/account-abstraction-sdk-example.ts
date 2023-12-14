// Welcome to the ERC-4337 tutorial #1!
// This tutorial walks you though a simple ERC-4337 transaction: sending a User Operation
// with gas paid by a Paymaster.
//
// You can view more information about this tutorial at
// https://docs.stackup.sh/docs/get-started-with-stackup
//
// Enter `npm run dev` into your terminal to run.

// This example uses the account-abstraction/sdk library to build the transaction, but
// you can use any library.

import { ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { PaymasterAPI, calcPreVerificationGas, SimpleAccountAPI } from "@account-abstraction/sdk";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { HttpRpcClient } from "@account-abstraction/sdk/dist/src/HttpRpcClient";

const rpcUrl ="https://public.stackup.sh/api/v1/node/ethereum-goerli";
const paymasterUrl = ""; // Optional

// Extend the Ethereum Foundation's account-abstraction/sdk's basic paymaster
class VerifyingPaymasterAPI extends PaymasterAPI {
  private paymasterUrl: string;
  private entryPoint: string;
  constructor(paymasterUrl: string, entryPoint: string) {
    super();
    this.paymasterUrl = paymasterUrl;
    this.entryPoint = entryPoint;
  }

  async getPaymasterAndData(
    userOp: Partial<UserOperationStruct>
  ): Promise<string> {
    // Hack: userOp includes empty paymasterAndData which calcPreVerificationGas requires.
    try {
      // userOp.preVerificationGas contains a promise that will resolve to an error.
      await ethers.utils.resolveProperties(userOp);
      // eslint-disable-next-line no-empty
    } catch (_) {}
    const pmOp: Partial<UserOperationStruct> = {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit,
      verificationGasLimit: userOp.verificationGasLimit,
      maxFeePerGas: userOp.maxFeePerGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
      // Dummy signatures are required in order to calculate a correct preVerificationGas value.
      paymasterAndData:"0x0101010101010101010101010101010101010101000000000000000000000000000000000000000000000000000001010101010100000000000000000000000000000000000000000000000000000000000000000101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101",
      signature: "0xa15569dd8f8324dbeabf8073fdec36d4b754f53ce5901e283c6de79af177dc94557fa3c9922cd7af2a96ca94402d35c39f266925ee6407aeb32b31d76978d4ba1c",
    };
    const op = await ethers.utils.resolveProperties(pmOp);
    op.preVerificationGas = calcPreVerificationGas(op);
    op.verificationGasLimit = ethers.BigNumber.from(op.verificationGasLimit).mul(3);

    // Ask the paymaster to sign the transaction and return a valid paymasterAndData value.
    const params = [await OptoJSON(op), this.entryPoint, {"type": "payg"}];
    const provider = new ethers.providers.JsonRpcProvider(paymasterUrl);
    const response = await provider.send("pm_sponsorUserOperation", params);

    return response.data.result.toString();
  }
}

async function OptoJSON(op: Partial<UserOperationStruct>): Promise<any> {
    const userOp = await ethers.utils.resolveProperties(op);
    return Object.keys(userOp)
        .map((key) => {
            let val = (userOp as any)[key];
            if (typeof val !== "string" || !val.startsWith("0x")) {
                val = ethers.utils.hexValue(val);
            }
            return [key, val];
        })
        .reduce(
            (set, [k, v]) => ({
                ...set,
                [k]: v,
            }),
            {}
        );
}

// MAIN FUNCTION
async function main() {

    // Create the paymaster API
    const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    const paymasterAPI = new VerifyingPaymasterAPI(paymasterUrl, entryPointAddress);

    // Initialize the account
    const provider = new JsonRpcProvider(rpcUrl);
    const factoryAddress = "0x9406Cc6185a346906296840746125a0E44976454";
    const signingKey = "0x4337433743374337433743374337433743374337433743374337433743374337";
    const owner = new ethers.Wallet(signingKey);
    const accountAPI = new SimpleAccountAPI({
        provider,
        entryPointAddress,
        owner,
        factoryAddress,
        paymasterAPI
    });
    
    const address = await accountAPI.getCounterFactualAddress();
    console.log(`Account address: ${address}`);

    // Create the call data
    const to = address; // Receiving address, in this case we will send it to ourselves
    const token = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B"; // Address of the ERC-20 token
    const value = "0"; // Amount of the ERC-20 token to transfer

    // Read the ERC-20 token contract
    const ERC20_ABI = require("./erc20Abi.json"); // ERC-20 ABI in json format
    const erc20 = new ethers.Contract(token, ERC20_ABI, provider);
    const decimals = await Promise.all([erc20.decimals()]);
    const amount = ethers.utils.parseUnits(value, decimals);

    // Encode the calls
    const callTo = [token, token];
    const callData = [erc20.interface.encodeFunctionData("approve", [to, amount]),
                    erc20.interface.encodeFunctionData("transfer", [to, amount])];

    // Build the user operation
    const accountContract = await accountAPI._getAccountContract();
    const fee = await provider.send("eth_maxPriorityFeePerGas", []);
    const block = await provider.getBlock("latest");
    const tip = ethers.BigNumber.from(fee);
    const buffer = tip.div(100).mul(13);
    const maxPriorityFeePerGas = tip.add(buffer);
    const maxFeePerGas = block.baseFeePerGas
        ? block.baseFeePerGas.mul(2).add(maxPriorityFeePerGas)
        : maxPriorityFeePerGas;

    const op = await accountAPI.createSignedUserOp({
        target: address,
        data: accountContract.interface.encodeFunctionData("executeBatch", [callTo, callData]),
        ... {maxFeePerGas, maxPriorityFeePerGas}
      });

    console.log("Signed User Operation: ");
    console.log(op);

    // Send the user operation
    const chainId = await provider.getNetwork().then((net => net.chainId));
    const client = new HttpRpcClient(rpcUrl, entryPointAddress, chainId);
    const userOpHash = await client.sendUserOpToBundler(op);

    console.log("Waiting for transaction...");
    const transactionHash = await accountAPI.getUserOpReceipt(userOpHash);
    console.log(`Transaction hash: ${transactionHash}`);
    console.log(`View here: https://jiffyscan.xyz/userOpHash/${userOpHash}`);

}

main().catch((err) => console.error("Error:", err));