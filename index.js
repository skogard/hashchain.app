require('dotenv').config();
const { BLOCK_TIME, IPFS_API_KEY, MATIC_URL, PUBLIC_KEY, PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(MATIC_URL);
const Contract = require("./artifacts/contracts/t.sol/Hashchain.json");
const express = require('express');
const level = require('level-rocksdb')
const fs = require('fs')
const { add } = require('./scripts/add')
const { NFTStorage, Blob } = require('nft.storage')
const Datastore = require('nedb')
const setTimeoutPromise = timeout => new Promise(resolve => {
  setTimeout(resolve, timeout);
});

class Chain {
  constructor(blocktime) {
    this.client = new NFTStorage({ token: IPFS_API_KEY })
    if (!fs.existsSync("db")) fs.mkdirSync("db")
    this.mempool = {};
    this.blocktime = blocktime
  }
  append (hash, item) {
    this.mempool[hash] = item;
  }
  waitTime() {
    console.log("this.checkpoint = ", this.checkpoint)
    console.log("this.blocktime = ", this.blocktime)
    // return seconds till next block
    return (this.checkpoint + this.blocktime - Date.now()) / 1000
  }
  start(o) {
    this.checkpoint = Date.now()
    setInterval(async () => {
      this.checkpoint = Date.now()
      let res = await this.mine()
      if (res) {
        o.onblock(res)
      } else {
        console.log("no transactions to mine!")
      }
    }, this.blocktime)
  }
  put(key, val) {
    return new Promise((resolve, reject) => {
      this.db.put(key, val, (err) => {
        if (err) {
          console.log("Error", err)
          process.exit(1)
        }
        resolve()
      })
    })
  }
  setLast(val) {
    return new Promise((resolve, reject) => {
      this.db.put("$last", val, (err) => {
        if (err) {
          console.log("Error", err)
          process.exit(1)
        }
        resolve()
      })
    })
  }
  getLast() {
    return new Promise((resolve, reject) => {
      this.db.get("$last", (err, value) => {
        if (err) {
          console.log("get $last error", err)
          resolve(null)
        } else {
          resolve(value)
        }
      })
    })
  }
  setBlock(hash, block) {
    return new Promise((resolve, reject) => {
      this.hashdb.put(hash, block, (err) => {
        if (err) {
          console.log("Error", err)
          process.exit(1)
        }
        resolve()
      })
    })
  }
  getBlock(hash) {
    return new Promise((resolve, reject) => {
      this.hashdb.get(hash, (err, value) => {
        if (err) {
          console.log("get block error", err)
          resolve(null)
        } else {
          resolve(value)
        }
      })
    })
  }
  async mine() {
    // turn into csv
    let size = Object.keys(this.mempool).length;
    if (size > 0) {
      let str = Object.values(this.mempool).join("\n")


      const buf = Buffer.from(str)
      // write mempool to IPFS
      const cid = await this.client.storeBlob(buf)

      // write ipfs hash to local blocks db
      let lastBlock = await this.getLast()
      if (!lastBlock) {
        lastBlock = "GENESIS";
      }
      await this.put(lastBlock, cid)
      await this.setLast(cid)

      // add hashes to hashdb (hash => block)
      console.log("add hashes to hashdb")
      for(let hash of Object.keys(this.mempool)) {
        console.log(`${hash} => ${cid}`)
        await this.setBlock(hash, cid)
      }

      // Index events to event db
      console.log("render", Contract.abi)
      let fromBlock = await web3.eth.getBlockNumber() - 5000
      console.log("fromBlock = ", fromBlock)

      this.mempool = {}

      let response = await add(lastBlock, cid)
      return {
        size, cid, response
      }
    } else {
      return null
    }
  }
}
console.log("BLOCK_TIME = ", BLOCK_TIME)
const chain = new Chain(1000*60*Number(BLOCK_TIME))
chain.start({
  onblock: ({ size, cid, response }) => {
    console.log("Block mined")
    console.log("ipfs://" + cid)
    console.log("https://ipfs.io/ipfs/" + cid)
    console.log("Blockchain response:", response)
  }
})
const app = express();
const contract = new web3.eth.Contract(Contract.abi, CONTRACT_ADDRESS);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static('./public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }))
app.post("/append", async (req, res) => {
  console.log("append", req.body)
  /*******************************************************************
  IPFS_CID,OWNER_PUBKEY,OWNER_SIGNATURE
  *******************************************************************/
  chain.append(req.body.msg, `${req.body.msg},${req.body.pubkey},${req.body.sig}`)
  res.json(req.body)
})
app.get("/", async (req, res) => {
  let waitTime = chain.waitTime()
  console.log("watiTime = ", waitTime)
  res.render("index", {
    contract: CONTRACT_ADDRESS,
    waitTime: waitTime,
    events: []
  })
})
app.get("/events", (req, res) => {
  console.log("render")
  chain.events.find({}).sort({
    blockNumber: -1
  }).limit(100).exec((err, docs) => {
    console.log("got")
    let events = docs.map((ee) => {
      console.log("ee = ", ee)
      return {
        bn: ee.blockNumber,
        bh: ee.blockHash,
        tx: ee.transactionHash,
        prev: ee.returnValues.prev,
        current: ee.returnValues.current,
      }
    })
    res.json({
      events: events
    })
  })
})
app.get("/artifact", (req, res) => {
  console.log("Contract =", Contract)
  res.json(Contract)
})
app.get("/block/:hash", async (req, res) => {
  chain.events.findOne({
    "returnValues.current": req.params.hash
  }).limit(1).exec((err, doc) => {
    res.render("block", doc)
  })
})
app.get("/check/:id", async (req, res) => {
  let val = await chain.getBlock(req.params.id)
  console.log("check = ", val)
  res.json({ block: val })
})
app.listen(3000, () => {
  console.log(`app Started on port 3000!`)
});
