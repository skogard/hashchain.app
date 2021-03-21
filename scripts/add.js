require('dotenv').config();
const IPFS = require('ipfs-core')
const { NFTStorage, Blob } = require('nft.storage')
const { IPFS_API_KEY, MATIC_URL, PUBLIC_KEY, PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(MATIC_URL);
const Contract = require("../artifacts/contracts/t.sol/Hashchain.json");

console.log(JSON.stringify(Contract.abi));

const contract = new web3.eth.Contract(Contract.abi, CONTRACT_ADDRESS);

const send = (tx) => {
  return new Promise((resolve, reject) => {
    web3.eth.sendSignedTransaction(tx, function(err, hash) {
      if (!err) {
        console.log("The hash of your transaction is: ", hash)
        resolve(hash)
      } else {
        console.log("error", err)
        reject(err)
      }
    });
  })
}
const add = async (prev, current) => {
  console.log("add = ", prev, current)
  const nonce = await web3.eth.getTransactionCount(PUBLIC_KEY, 'latest'); //get latest nonce

  //the transaction
  const tx = {
    'from': PUBLIC_KEY,
    'to': CONTRACT_ADDRESS,
    'nonce': nonce,
    'gas': 500000,
    'data': contract.methods.add(prev, current).encodeABI()
  };

  const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
  console.log("signedTx = ", signedTx)
  try {
    let response = await send(signedTx.rawTransaction)
    return response
  } catch (e) {
    console.log(" Promise failed:", e);
  }
}
module.exports = {
  add
}
