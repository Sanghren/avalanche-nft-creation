import { URLPayload } from "avalanche/dist/utils";
import { Avalanche, BinTools, BN } from "avalanche"
import {
    AVMAPI,
    KeyChain,
    MinterSet,
    Tx,
    UnsignedTx,
} from "avalanche/dist/apis/avm"
import { OutputOwners } from "avalanche/dist/common";
const mstimeout: number = 5000
import { Buffer } from 'buffer/'

// Setting up the connection to the AvalancheGo Node
const ip: string = "localhost"
const protocol: string = "http"
const networkID: number = 12345
const port: number = 9650
const avalanche: Avalanche = new Avalanche(ip, port, protocol, networkID)

//
const bintools: BinTools = BinTools.getInstance()
const avm: AVMAPI = avalanche.XChain()
const xKeychain: KeyChain = avm.keyChain()
const sleep = (ms: number): Promise<unknown> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}
//ToDo Uh ?
const imgs = [
    "https://i.ibb.co/hs6CW8j/brown-Copy.png",
    "https://i.ibb.co/yQ8hfwB/turquese.png",
    "https://i.ibb.co/RQpFfYP/white.png",
    "https://i.ibb.co/pZyYF1M/yellow.png",
    "https://i.ibb.co/HHyZcvm/grey.png",
    "https://i.ibb.co/wyQk605/green.png",
    "https://i.ibb.co/qM5Hs5t/blue-Copy.png",
    "https://i.ibb.co/ydXY8bD/pink.png",
    "https://i.ibb.co/mqfx1NJ/strong-red.png"
]

const memos = [];
for (let img of imgs) {
    memos.push(new URLPayload(Buffer.from(img)).getPayload())
    console.log(new URLPayload(Buffer.from(img)).getPayload())
}

// PKey on local network containing lot of AVAX
xKeychain.importKey("PrivateKey-ewoqjP7PxY4yr3iLTpLisriqt94hdyDFNgchSxGGztUrTXtNN")

// Fetch all addresses (buffer format) linked to the Pkey
const xAddresses: Buffer[] = avm.keyChain().getAddresses()

// Readable format for address, debug purpose
const xAddressStrings: string[] = avm.keyChain().getAddressStrings()
console.log(xAddressStrings)

async function createNewNFTAsset() {
    const minterSets: MinterSet[] = []

    // Create the groups
    for (var i = 0; i < imgs.length; i++) {
        const minterSet: MinterSet = new MinterSet(1, xAddresses)
        minterSets.push(minterSet);
    }

    let {utxos: utxoSet} = await avm.getUTXOs(xAddressStrings);

    let unsignedTx: UnsignedTx = await avm.buildCreateNFTAssetTx(
        utxoSet,
        xAddressStrings,
        xAddressStrings,
        minterSets,
        "AVHAT",
        "HAT",
    )


    let tx: Tx = unsignedTx.sign(xKeychain);
    let txid: string = await avm.issueTx(tx)
    await sleep(mstimeout)

    console.log(`Create NFT Asset Success: ${txid}`)
    return txid;
}

async function mintNFT(assetID: string, memo: Buffer) {
    let {utxos: utxos} = await avm.getUTXOs(xAddressStrings);
    let owners = [];

    for (var i = 0; i < imgs.length; i++) {
        let owner = new OutputOwners([xAddresses[0]], new BN(0), 1);
        owners.push(owner)
    }

    let mintTx = await avm.buildCreateNFTMintTx(utxos, owners, xAddressStrings, xAddressStrings, assetID, 0, memo)
    let signedTx = mintTx.sign(xKeychain);

    let txId = await avm.issueTx(signedTx);
    return txId;
}

async function transferNFT(assetID) {

    let {utxos} = await avm.getUTXOs(xAddressStrings);
    let utxoids = utxos.getUTXOIDs();

    let sourceTxId: string = "";

    for (let index: number = 0; index < utxoids.length; ++index) {
        let value = utxoids[index];
        if (value.substring(0, 10) === assetID.substring(0, 10)) {
            sourceTxId = value
            break
        }
    }

    console.log("Source tx: ", sourceTxId);


    let unsignedTx = await avm.buildNFTTransferTx(
        utxos,
        xAddressStrings,
        xAddressStrings,
        xAddressStrings,
        sourceTxId,
    )

    let tx = unsignedTx.sign(avm.keyChain());
    let txid = await avm.issueTx(tx)
    console.log(`NFT Transfer Operation Success: ${txid}`)
    return txid;
}

const main = async (): Promise<any> => {

    // ===========================================
    // First we will create an asset for our NFT .
    // ===========================================

    const txID = await createNewNFTAsset();
    for (let memo of memos) {
        // Now we can Mint our NFT .
        console.log('Minting a new NFT !!!!!');
        await mintNFT(txID, memo);
        console.log('Now we can transfer it !!!!')
        await transferNFT(txID);
        console.log('============================== \n')

        // step 3 transfer NFT
    }

}

main()
