import { URLPayload } from "avalanche/dist/utils";
import { Avalanche, BinTools, BN } from "avalanche"
import { Buffer } from 'buffer/'
import {
    AmountOutput,
    AVMAPI,
    AVMConstants,
    CreateAssetTx,
    InitialStates,
    KeyChain,
    MinterSet,
    NFTMintOperation,
    NFTMintOutput,
    NFTTransferOperation,
    NFTTransferOutput,
    OperationTx,
    SECPTransferInput,
    SECPTransferOutput,
    TransferableInput,
    TransferableOperation,
    TransferableOutput,
    Tx,
    UnsignedTx,
    UTXO,
    UTXOSet
} from "avalanche/dist/apis/avm"
import { OutputOwners } from "avalanche/dist/common"

const sleep = (ms: number): Promise<unknown> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// Here we look for a specific UTXO  (txId correspond to the assetId of the NFT)
const getUTXOIDs = (utxoSet: UTXOSet, txid: string, outputType: number = AVMConstants.SECPMINTOUTPUTID): string[] => {
    const utxoids: string[] = utxoSet.getUTXOIDs()
    let result: string[] = []
    for (let index: number = 0; index < utxoids.length; ++index) {
        console.log(`We are looking for : ${outputType} -- ${txid.slice(0, 10)} -- Curent utxoid ${utxoids[index]} -- ${utxoSet.getUTXO(utxoids[index]).getOutput().getOutputID()}`)
        if (utxoids[index].indexOf(txid.slice(0, 10)) !== -1 && utxoSet.getUTXO(utxoids[index]).getOutput().getOutputID() === outputType) {
            result.push(utxoids[index])
        }
    }
    return result
}

// Setting up the connection to the AvalancheGo Node
const ip: string = "localhost"
const protocol: string = "http"
const networkID: number = 12345
const port: number = 9650
const avalanche: Avalanche = new Avalanche(ip, port, protocol, networkID)

//
const bintools: BinTools = BinTools.getInstance()
const avm: AVMAPI = avalanche.XChain()
const blockchainID: Buffer = bintools.cb58Decode(avm.getBlockchainID())
const xKeychain: KeyChain = avm.keyChain()

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
// const imgs = [
//     "https://i.ibb.co/mqfx1NJ/strong-red.png"
// ]

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


const locktime: BN = new BN(0)
const threshold: number = 1
let ins: TransferableInput[] = []
let outs: TransferableOutput[] = []
let ops: TransferableOperation[] = []
const mstimeout: number = 5000

const main = async (): Promise<any> => {

    // ===========================================
    // First we will create an asset for our NFT .
    // ===========================================

    const assetID: Buffer = await avm.getAVAXAssetID()
    let result: any = await avm.getBalance(xAddressStrings[0], bintools.cb58Encode(assetID))
    let balance: BN = new BN(result.balance)
    let fee: BN = avm.getCreationTxFee()

    // We substract the fee of the current balance
    let avaxAmount: BN = balance.sub(fee)
    // We create one of the output of our Tx (Balance in AVAX - fee)
    let secpOutput: SECPTransferOutput = new SECPTransferOutput(avaxAmount, xAddresses, locktime, threshold)
    let transferableOutput: TransferableOutput = new TransferableOutput(assetID, secpOutput)
    outs.push(transferableOutput)

    // We fetch the UTXOs of the current address
    let {utxos: utxoSet} = await avm.getUTXOs([xAddressStrings[0]])

    // Here we select one UTXO where there is enough AVAX to pay for the fee .
    let utxos: UTXO[] = utxoSet.getAllUTXOs().filter(u => u.getOutput().getTypeName() === 'SECPTransferOutput' && u.getOutput().getOutputID() === 7)
    let utxo: UTXO;
    for (let aUtxo of utxos) {
        let output: AmountOutput = aUtxo.getOutput() as AmountOutput
        let amt: BN = output.getAmount().clone()
        if (amt > 10000000) {
            utxo = aUtxo
            break;
        }
    }

    let output: AmountOutput = utxo.getOutput() as AmountOutput
    let amt: BN = output.getAmount().clone()
    let txid: Buffer = utxo.getTxID()
    let outputidx: Buffer = utxo.getOutputIdx()

    let secpInput: SECPTransferInput = new SECPTransferInput(amt)
    secpInput.addSignatureIdx(0, xAddresses[0])
    // We create the transferable input, pointing to the Tx where we have enough AVAX for the fee .
    let transferableInput: TransferableInput = new TransferableInput(txid, outputidx, assetID, secpInput)
    ins.push(transferableInput)

    // Some info about our new Asset
    const name: string = "AVHAT"
    const symbol: string = "HAT"
    const initialStates: InitialStates = new InitialStates()
    // Not sure what the 'groupID' represent .
    const groupID: number = 42

    // This represent the addresses that can Mint this Asset.
    const minterSets: MinterSet[] = [new MinterSet(threshold, xAddresses)]

    // Threshold represent the number of signatures we need in order to mint a new asset .
    const nftMintOutput: NFTMintOutput = new NFTMintOutput(
        groupID,
        minterSets[0].getMinters(),
        locktime,
        minterSets[0].getThreshold()
    )

    initialStates.addOutput(nftMintOutput, AVMConstants.NFTFXID)
    const denomination: number = 0

    const createAssetTx: CreateAssetTx = new CreateAssetTx(networkID, blockchainID, outs, ins, Buffer.from("AVHAT"), name, symbol, denomination, initialStates)
    let unsignedTx: UnsignedTx = new UnsignedTx(createAssetTx)
    let tx: Tx = unsignedTx.sign(xKeychain)
    let id: string = await avm.issueTx(tx)
    console.log(id)
    await sleep(mstimeout)

    // Now we can Mint our NFT .
    ins = []
    outs = []

    // Again here we fetch the fee, create the output which will contain the balance - fee .
    result = await avm.getBalance(xAddressStrings[0], bintools.cb58Encode(assetID))
    balance = new BN(result.balance)
    avaxAmount = balance.sub(fee)
    secpOutput = new SECPTransferOutput(avaxAmount, xAddresses, locktime, threshold)
    transferableOutput = new TransferableOutput(assetID, secpOutput)
    outs.push(transferableOutput)

    // We prepare the Mint Operation
    const payload: Buffer = memos[0]

    // ToDo Still no clue what 'groupID' represent exactly here .
    const nftMintOperation: NFTMintOperation = new NFTMintOperation(groupID, payload, [new OutputOwners(xAddresses, locktime, threshold)])
    // We fetch the latest UTXOs for our addresses.
    let {utxos: utxoSet2} = await avm.getUTXOs(xAddressStrings)
    // We specifically want to find one that refer to a 'Transfer' for a specific 'id'
    // Don't forget that TxID === AssetId . If am not wrong .
    let secpUTXOIDs: string[] = getUTXOIDs(utxoSet2, id, AVMConstants.SECPXFEROUTPUTID)
    let secpUtxo: UTXO = utxoSet2.getUTXO(secpUTXOIDs[0])

    output = secpUtxo.getOutput() as AmountOutput
    amt = output.getAmount().clone()
    txid = secpUtxo.getTxID()
    outputidx = secpUtxo.getOutputIdx()

    secpInput = new SECPTransferInput(amt)
    secpInput.addSignatureIdx(0, xAddresses[0])

    transferableInput = new TransferableInput(txid, outputidx, assetID, secpInput)
    ins.push(transferableInput)

    let utxoids: string[] = getUTXOIDs(utxoSet2, id, AVMConstants.NFTMINTOUTPUTID)

    utxo = utxoSet2.getUTXO(utxoids[0])
    let out: NFTTransferOutput = utxo.getOutput() as NFTTransferOutput
    let spenders: Buffer[] = out.getSpenders(xAddresses)

    spenders.forEach((spender: Buffer) => {
        const idx: number = out.getAddressIdx(spender)
        nftMintOperation.addSignatureIdx(idx, spender)
    })

    let transferableOperation: TransferableOperation = new TransferableOperation(utxo.getAssetID(), utxoids, nftMintOperation)
    ops.push(transferableOperation)

    let operationTx: OperationTx = new OperationTx(networkID, blockchainID, outs, ins, Buffer.from("AVHAT"), ops)
    unsignedTx = new UnsignedTx(operationTx)
    tx = unsignedTx.sign(xKeychain)
    let mint_tx_id = await avm.issueTx(tx)
    console.log(`MINT NFT TX ID ${mint_tx_id}`)
    await sleep(mstimeout)

    // step 3 transfer NFT
    ins = []
    outs = []
    ops = []
    result = await avm.getBalance(xAddressStrings[0], bintools.cb58Encode(assetID))
    balance = new BN(result.balance)
    avaxAmount = balance.sub(fee)
    secpOutput = new SECPTransferOutput(avaxAmount, xAddresses, locktime, threshold)
    transferableOutput = new TransferableOutput(assetID, secpOutput)
    outs.push(transferableOutput)
    let {utxos: utxoSet3} = await avm.getUTXOs(xAddressStrings)
    secpUTXOIDs = getUTXOIDs(utxoSet3, mint_tx_id, AVMConstants.SECPXFEROUTPUTID)
    secpUtxo = utxoSet3.getUTXO(secpUTXOIDs[0])

    output = secpUtxo.getOutput() as AmountOutput
    amt = output.getAmount().clone()
    txid = secpUtxo.getTxID()
    outputidx = secpUtxo.getOutputIdx()

    secpInput = new SECPTransferInput(amt)
    secpInput.addSignatureIdx(0, xAddresses[0])

    transferableInput = new TransferableInput(txid, outputidx, assetID, secpInput)
    ins.push(transferableInput)

    utxoids = getUTXOIDs(utxoSet3, mint_tx_id, AVMConstants.NFTXFEROUTPUTID)

    utxo = utxoSet3.getUTXO(utxoids[0])
    out = utxo.getOutput() as NFTTransferOutput
    spenders = out.getSpenders(xAddresses)

    // Address to which we will send the newly minted NFT
    const xaddy: Buffer = bintools.stringToAddress("X-local1ax8r353sm3k5jj0cm6ef2e2c5zs6lyjuup7p2h")

    const outbound: NFTTransferOutput = new NFTTransferOutput(
        out.getGroupID(), out.getPayload(), [xaddy], locktime, threshold,
    )
    const op: NFTTransferOperation = new NFTTransferOperation(outbound)

    spenders.forEach((spender: Buffer) => {
        const idx: number = out.getAddressIdx(spender)
        op.addSignatureIdx(idx, spender)
    })

    const xferop: TransferableOperation = new TransferableOperation(utxo.getAssetID(), [utxoids[0]], op)
    ops.push(xferop)

    operationTx = new OperationTx(networkID, blockchainID, outs, ins, memos[0], ops)
    unsignedTx = new UnsignedTx(operationTx)
    tx = unsignedTx.sign(xKeychain)
    let new_id = await avm.issueTx(tx)
    console.log(`TRF NFT TX ID ${new_id}`)
}

main()
