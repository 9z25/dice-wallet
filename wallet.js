

const fs = require('fs')

var lang = 'english' // Set the language of the wallet.

// These objects used for writing wallet information out to a file.
let outStr = ''
var outObj = {}


var express = require("express");

var cors = require('cors')


var app = express()
app.use(cors())
var app = express();
app.listen(3000, () => {
    console.log("Server running on port 3000");
});



let wallet = {};


app.get("/createWallet/", (req, res, next) => {


    // REST API servers.
const BCHN_MAINNET = 'https://bchn.fullstack.cash/v4/'

// bch-js-examples require code from the main bch-js repo
const BCHJS = require('@psf/bch-js')

// Instantiate bch-js based on the network.
const bchjs = new BCHJS({ restURL: BCHN_MAINNET })


async function createWallet () {
  const lang = 'english'
  let outStr = ''
  const outObj = {}

  // create 128 bit BIP39 mnemonic
  const mnemonic = bchjs.Mnemonic.generate(
    128,
    bchjs.Mnemonic.wordLists()[lang]
  )
  outObj.mnemonic = mnemonic

  
  






   // root seed buffer
   const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic)

   // master HDNode
   const masterHDNode = bchjs.HDNode.fromSeed(rootSeed)
 
   // HDNode of BIP44 account
   const account = bchjs.HDNode.derivePath(masterHDNode, "m/44'/245'/0'")
   outStr += "BIP44 Account: \"m/44'/245'/0'\"\n"
 
let i = 0;
     const childNode = masterHDNode.derivePath(`m/44'/245'/0'/0/${i}`)
     outObj.cashAddress = bchjs.HDNode.toCashAddress(childNode)
       outObj.cashAddress = bchjs.HDNode.toCashAddress(childNode)
       outObj.WIF = bchjs.HDNode.toWIF(childNode)
       outObj.slpAddress = bchjs.SLP.Address.toSLPAddress(outObj.cashAddress)
       outObj.legacyAddress = bchjs.Address.toLegacyAddress(outObj.cashAddress)
 
   // derive the first external change address HDNode which is going to spend utxo
   const change = bchjs.HDNode.derivePath(account, '0/0')
 
   // get the cash address
   bchjs.HDNode.toCashAddress(change)


   wallet = outObj;
   res.json(outObj);
  }
createWallet();


});



app.get("/pay/:recAddr/:amount/:cashAddress/:mnemonic", (req, res, next) => {
  

    // REST API servers.
const BCHN_MAINNET = 'https://bchn.fullstack.cash/v4/'

// bch-js-examples require code from the main bch-js repo
const BCHJS = require('@psf/bch-js')

// Instantiate bch-js based on the network.
const bchjs = new BCHJS({ restURL: BCHN_MAINNET })

    /*
  Send 1000 satoshis to RECV_ADDR.
*/

    // Replace the address below with the address you want to send the BCH to.
    let RECV_ADDR = req.params.recAddr.toString();

    // set satoshi amount to send
    var SATOSHIS_TO_SEND = parseInt(req.params.amount);




    var SEND_ADDR = req.params.cashAddress.toString();
    var SEND_MNEMONIC = req.params.mnemonic.toString().replace("%20"," ");;


    async function sendBch() {
        try {
            // Get the balance of the sending address.
            var balance = await getBCHBalance(SEND_ADDR, false)
            console.log(`balance: ${JSON.stringify(balance, null, 2)}`)
            console.log(`Balance of sending address ${SEND_ADDR} is ${balance} BCH.`)

            // Exit if the balance is zero.
            if (balance <= 0.0) {
                console.log('Balance of sending address is zero. Exiting.')
                //process.exit(0)
            }

            // If the user fails to specify a reciever address, just send the BCH back
            // to the origination address, so the example doesn't fail.
            if (RECV_ADDR === '') RECV_ADDR = SEND_ADDR

            // Convert to a legacy address (needed to build transactions).
            var SEND_ADDR_LEGACY = bchjs.Address.toLegacyAddress(SEND_ADDR)
            var RECV_ADDR_LEGACY = bchjs.Address.toLegacyAddress(RECV_ADDR)
            console.log(`Sender Legacy Address: ${SEND_ADDR_LEGACY}`)
            console.log(`Receiver Legacy Address: ${RECV_ADDR_LEGACY}`)

            // Get UTXOs held by the address.
            // https://developer.bitcoin.com/mastering-bitcoin-cash/4-transactions/
            var utxos = await bchjs.Electrumx.utxo(SEND_ADDR)
            // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`);

            if (utxos.utxos.length === 0) throw new Error('No UTXOs found.')

            // console.log(`u: ${JSON.stringify(u, null, 2)}`
            var utxo = await findBiggestUtxo(utxos.utxos)
            // console.log(`utxo: ${JSON.stringify(utxo, null, 2)}`);

            // instance of transaction builder
            var transactionBuilder = new bchjs.TransactionBuilder()

            // Essential variables of a transaction.
            var satoshisToSend = SATOSHIS_TO_SEND
            var originalAmount = utxo.value
            var vout = utxo.tx_pos
            var txid = utxo.tx_hash

            // add input with txid and index of vout
            transactionBuilder.addInput(txid, vout)

            // get byte count to calculate fee. paying 1.2 sat/byte
            var byteCount = bchjs.BitcoinCash.getByteCount({
                P2PKH: 1
            }, {
                P2PKH: 2
            })
            console.log(`Transaction byte count: ${byteCount}`)
            var satoshisPerByte = 1.2
            var txFee = Math.floor(satoshisPerByte * byteCount)
            console.log(`Transaction fee: ${txFee}`)

            // amount to send back to the sending address.
            // It's the original amount - 1 sat/byte for tx size
            var remainder = originalAmount - satoshisToSend - txFee

            if (remainder < 0) {
                throw new Error('Not enough BCH to complete transaction!')
            }

            // add output w/ address and amount to send
            transactionBuilder.addOutput(RECV_ADDR, satoshisToSend)
            transactionBuilder.addOutput(SEND_ADDR, remainder)

            // Generate a change address from a Mnemonic of a private key.
            var change = await changeAddrFromMnemonic(SEND_MNEMONIC)

            // Generate a keypair from the change address.
            var keyPair = bchjs.HDNode.toKeyPair(change)

            // Sign the transaction with the HD node.
            let redeemScript
            transactionBuilder.sign(
                0,
                keyPair,
                redeemScript,
                transactionBuilder.hashTypes.SIGHASH_ALL,
                originalAmount
            )

            // build tx
            var tx = transactionBuilder.build()
            // output rawhex
            var hex = tx.toHex()
            // console.log(`TX hex: ${hex}`);
            console.log(' ')

            // Broadcast transation to the network
            var txidStr = await bchjs.RawTransactions.sendRawTransaction([hex])
            // import from util.js file
            var util = require('./util/util.js')
            console.log(`Transaction ID: ${txidStr}`)
            console.log('Check the status of your transaction on this block explorer:')
            util.transactionStatus(txidStr, 'mainnet')
            var msg = {}
            msg.id = `Transaction ID: ${txidStr}`
            msg.line = 'Check the status of your transaction on this block explorer:'
            res.json(msg);
        } catch (err) {
            console.log('error: ', err)
        }
    }
    sendBch()

    // Generate a change address from a Mnemonic of a private key.
    async function changeAddrFromMnemonic(mnemonic) {
        // root seed buffer
        var rootSeed = await bchjs.Mnemonic.toSeed(mnemonic)

        // master HDNode
        var masterHDNode = bchjs.HDNode.fromSeed(rootSeed)

        // HDNode of BIP44 account
        var account = bchjs.HDNode.derivePath(masterHDNode, "m/44'/145'/0'")

        // derive the first external change address HDNode which is going to spend utxo
        var change = bchjs.HDNode.derivePath(account, '0/0')

        return change
    }

    // Get the balance in BCH of a BCH address.
    async function getBCHBalance(addr, verbose) {
        try {
            var result = await bchjs.Electrumx.balance(addr)

            if (verbose) console.log(result)

            // The total balance is the sum of the confirmed and unconfirmed balances.
            var satBalance =
                Number(result.balance.confirmed) + Number(result.balance.unconfirmed)

            // Convert the satoshi balance to a BCH balance
            var bchBalance = bchjs.BitcoinCash.toBitcoinCash(satBalance)

            return bchBalance
        } catch (err) {
            console.error('Error in getBCHBalance: ', err)
            console.log(`addr: ${addr}`)
            throw err
        }
    }

    // Returns the utxo with the biggest balance from an array of utxos.
    async function findBiggestUtxo(utxos) {
        let largestAmount = 0
        let largestIndex = 0

        for (var i = 0; i < utxos.length; i++) {
            var thisUtxo = utxos[i]
            // console.log(`thisUTXO: ${JSON.stringify(thisUtxo, null, 2)}`);

            // Validate the UTXO data with the full node.
            var txout = await bchjs.Blockchain.getTxOut(
                thisUtxo.tx_hash,
                thisUtxo.tx_pos
            )
            if (txout === null) {
                // If the UTXO has already been spent, the full node will respond with null.
                console.log(
                    'Stale UTXO found. You may need to wait for the indexer to catch up.'
                )
                continue
            }

            if (thisUtxo.value > largestAmount) {
                largestAmount = thisUtxo.value
                largestIndex = i
            }
        }

        return utxos[largestIndex]
    }

});












app.get("/getBalance/:mnemonic", (req, res, next) => {
async function getBalance () {
  try {
    const mnemonic = req.params.mnemonic.toString().replace("%20"," ");

    // root seed buffer
    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic)

    // master HDNode
    const masterHDNode = bchjs.HDNode.fromSeed(rootSeed)

    // HDNode of BIP44 account
    const account = bchjs.HDNode.derivePath(masterHDNode, "m/44'/245'/0'")

    const change = bchjs.HDNode.derivePath(account, '0/0')

    // get the cash address
    const cashAddress = bchjs.HDNode.toCashAddress(change)
    const slpAddress = bchjs.SLP.Address.toSLPAddress(cashAddress)

    // first get BCH balance
    const balance = await bchjs.Electrumx.balance(cashAddress)

    console.log(`BCH Balance information for ${slpAddress}:`)
    console.log(`${JSON.stringify(balance.balance, null, 2)}`)
    console.log('SLP Token information:')

    // get token balances
    try {
      const tokens = await bchjs.SLP.Utils.balancesForAddress(slpAddress)

      console.log(JSON.stringify(tokens, null, 2))
    } catch (error) {
      if (error.message === 'Address not found') console.log('No tokens found.')
      else console.log('Error: ', error)
    }
  } catch (err) {
    console.error('Error in getBalance: ', err)
    console.log(`Error message: ${err.message}`)
    throw err
  }
}
getBalance()
});


app.get("/sendAll/:recAddr/:cashAddress/:mnemonic", (req, res, next) => {
    /*
  Send all BCH from one address to another. Similar to consolidating UTXOs.
*/

// Edit this variable to direct where the BCH should be sent. By default, it
// will be sent to the address in the wallet.
let RECV_ADDR = req.params.recAddr.toString();

// REST API servers.
var BCHN_MAINNET = 'https://bchn.fullstack.cash/v4/'

// bch-js-examples require code from the main bch-js repo
var BCHJS = require('@psf/bch-js')

// Instantiate bch-js based on the network.
var bchjs = new BCHJS({ restURL: BCHN_MAINNET })

var SEND_ADDR = req.params.cashAddress.toString();
var SEND_MNEMONIC = walletInfo.mnemonic.toString();

// Send the money back to the same address. Edit this if you want to send it
// somewhere else.
if (RECV_ADDR === '') RECV_ADDR = walletInfo.cashAddress

async function sendAll () {
  try {
    // instance of transaction builder
    var transactionBuilder = new bchjs.TransactionBuilder()

    let sendAmount = 0
    var inputs = []

    let utxos = await bchjs.Electrumx.utxo(SEND_ADDR)
    utxos = utxos.utxos

    // Loop through each UTXO assigned to this address.
    for (let i = 0; i < utxos.length; i++) {
      var thisUtxo = utxos[i]

      inputs.push(thisUtxo)

      sendAmount += thisUtxo.value

      // ..Add the utxo as an input to the transaction.
      transactionBuilder.addInput(thisUtxo.tx_hash, thisUtxo.tx_pos)
    }

    // get byte count to calculate fee. paying 1 sat/byte
    var byteCount = bchjs.BitcoinCash.getByteCount(
      { P2PKH: inputs.length },
      { P2PKH: 1 }
    )
    console.log(`byteCount: ${byteCount}`)

    var satoshisPerByte = 1.1
    var txFee = Math.ceil(satoshisPerByte * byteCount)
    console.log(`txFee: ${txFee}`)

    // Exit if the transaction costs too much to send.
    if (sendAmount - txFee < 0) {
      console.log(
        "Transaction fee costs more combined UTXOs. Can't send transaction."
      )
      return
    }

    // add output w/ address and amount to send
    transactionBuilder.addOutput(RECV_ADDR, sendAmount - txFee)

    // Generate a change address from a Mnemonic of a private key.
    var change = await changeAddrFromMnemonic(SEND_MNEMONIC)

    // Generate a keypair from the change address.
    var keyPair = bchjs.HDNode.toKeyPair(change)

    // sign w/ HDNode
    let redeemScript
    inputs.forEach((input, index) => {
      transactionBuilder.sign(
        index,
        keyPair,
        redeemScript,
        transactionBuilder.hashTypes.SIGHASH_ALL,
        input.value
      )
    })

    // build tx
    var tx = transactionBuilder.build()
    // output rawhex
    var hex = tx.toHex()
    // console.log(`TX hex: ${hex}`)
    console.log(' ')

    // Broadcast transation to the network
    var txid = await bchjs.RawTransactions.sendRawTransaction([hex])

    var util = require('../util.js')
    console.log(`Transaction ID: ${txid}`)
    console.log('Check the status of your transaction on this block explorer:')
    util.transactionStatus(txid, 'mainnet')
  } catch (err) {
    console.log('error: ', err)
  }
}
sendAll()

// Generate a change address from a Mnemonic of a private key.
async function changeAddrFromMnemonic (mnemonic) {
  try {
    // root seed buffer
    var rootSeed = await bchjs.Mnemonic.toSeed(mnemonic)

    // master HDNode
    var masterHDNode = bchjs.HDNode.fromSeed(rootSeed)

    // HDNode of BIP44 account
    var account = bchjs.HDNode.derivePath(masterHDNode, "m/44'/145'/0'")

    // derive the first external change address HDNode which is going to spend utxo
    var change = bchjs.HDNode.derivePath(account, '0/0')

    return change
  } catch (err) {
    console.error('Error in changeAddrFromMnemonic()')
    throw err
  }
}

});