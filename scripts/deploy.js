async function main() {
   const Hashchain = await ethers.getContractFactory("Hashchain");

   // Start deployment, returning a promise that resolves to a contract object
   const hashchain = await Hashchain.deploy();
   console.log("Contract deployed to address:", hashchain.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
