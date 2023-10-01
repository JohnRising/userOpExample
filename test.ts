import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { Presets, Client } from "userop";

dotenv.config();
const signingKey = process.env.SIGNING_KEY || "";
const rpcUrl = process.env.RPC_URL || "";

async function createAccount() {
  try {
    const signer = new ethers.Wallet(signingKey);
    const builder = await Presets.Builder.SimpleAccount.init(signer, rpcUrl);
    const address = await builder.getSender();
    console.log("address-", address);

    const spender = address;
    // const token = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" // usdt
    // const token = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; //usdc
    // const token = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"; //dai
    const token = "0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1"; // test ERC-20 on Mumbai

    const erc20Interface = new ethers.utils.Interface([
      "function approve(address _spender, uint256 _value)",
    ]);
    const ERC20_ABI = require("./erc20Abi.json");
    const encodedData = ERC20_ABI.encodeFunctionData("transfer", [
      spender,
      ethers.BigNumber.from("1"),
    ]);

    await builder.executeBatch([token], [encodedData]);
    //await builder.execute(token, ethers.constants.Zero, encodedData);
    //console.log("userop: ", builder.getOp());

    const client = await Client.init(rpcUrl);
    const res = await client.sendUserOperation(
      builder, //.executeBatch([token], [encodedData]),
      {
        onBuild(op) {
          console.log("op", op);
        },
      }
    );
    console.log("opHash: ", res.userOpHash);
    const recipet = await res.wait();
    console.log("recipet: ", recipet?.transactionHash);
  } catch (error) {
    console.log("error: ", error);
  }
}

createAccount().catch((err) => console.error("Error:", err));
