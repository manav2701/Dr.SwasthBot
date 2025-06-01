// scripts/deploy.js
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const ConversationRegistry = await ethers.getContractFactory("ConversationRegistry");
  const registry = await ConversationRegistry.deploy();
  await registry.deployed();

  console.log("ConversationRegistry deployed to:", registry.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
