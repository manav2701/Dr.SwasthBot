require('dotenv').config();
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      chainId: 1337
    },
    sepolia: {
      url: process.env.ETH_RPC_URL,       // e.g. https://sepolia.infura.io/v3/…
      accounts: [process.env.PRIVATE_KEY] // must be prefixed with 0x
    }
    // (You can add other networks here if needed)
  }
};
