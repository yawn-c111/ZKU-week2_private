const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { utils } = ethers

const Utxo = require('../src/utxo')
const { transaction, prepareTransaction } = require('../src/index')
const { Keypair } = require('../src/keypair')
const { encodeDataForBridge } = require('./utils')

const MERKLE_TREE_HEIGHT = 5
const l1ChainId = 1
const MINIMUM_WITHDRAWAL_AMOUNT = utils.parseEther(process.env.MINIMUM_WITHDRAWAL_AMOUNT || '0.05')
const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(process.env.MAXIMUM_DEPOSIT_AMOUNT || '1')

describe('Custom Tests', function () {
  this.timeout(20000)

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName)
    const instance = await Factory.deploy(...args)
    return instance.deployed()
  }

  async function fixture() {
    require('../scripts/compileHasher')
    const [sender, gov, l1Unwrapper, multisig] = await ethers.getSigners()
    const verifier2 = await deploy('Verifier2')
    const verifier16 = await deploy('Verifier16')
    const hasher = await deploy('Hasher')

    const token = await deploy('PermittableToken', 'Wrapped ETH', 'WETH', 18, l1ChainId)
    await token.mint(sender.address, utils.parseEther('10000'))

    const amb = await deploy('MockAMB', gov.address, l1ChainId)
    const omniBridge = await deploy('MockOmniBridge', amb.address)

    /** @type {TornadoPool} */
    const tornadoPoolImpl = await deploy(
      'TornadoPool',
      verifier2.address,
      verifier16.address,
      MERKLE_TREE_HEIGHT,
      hasher.address,
      token.address,
      omniBridge.address,
      l1Unwrapper.address,
      gov.address,
      l1ChainId,
      multisig.address,
    )

    const { data } = await tornadoPoolImpl.populateTransaction.initialize(
      MINIMUM_WITHDRAWAL_AMOUNT,
      MAXIMUM_DEPOSIT_AMOUNT,
    )
    const proxy = await deploy(
      'CrossChainUpgradeableProxy',
      tornadoPoolImpl.address,
      gov.address,
      data,
      amb.address,
      l1ChainId,
    )

    const tornadoPool = tornadoPoolImpl.attach(proxy.address)

    await token.approve(tornadoPool.address, utils.parseEther('10000'))

    return { tornadoPool, token, proxy, omniBridge, amb, gov, multisig }
  }

  it('[assignment] ii. deposit 0.1 ETH in L1 -> withdraw 0.08 ETH in L2 -> assert balances', async () => {
    // [assignment] complete code here
    const { tornadoPool, token, omniBridge } = await loadFixture(fixture)

    // アリスの鍵を作成
    const aliceKeypair = new Keypair()

    // アリスが0.1ETHをデポジットするUTXOを作成
    const aliceDepositAmount = utils.parseEther('0.1')
    const aliceDepositUtxo = new Utxo({ amount: aliceDepositAmount, keypair: aliceKeypair })

    // アリスのデポジットUTXOを準備
    const { args, extData } = await prepareTransaction({
      tornadoPool,
      outputs: [aliceDepositUtxo],
    })

    // アリスのデポジットUTXOをブリッジするためのデータをエンコード
    const onTokenBridgedData = encodeDataForBridge({
      proof: args,
      extData,
    })

    // アリスのL1からブリッジしてL2にデポジットするためのTxを準備
    const onTokenBridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
      token.address,
      aliceDepositUtxo.amount,
      onTokenBridgedData,
    )

    // WETHをブリッジに送信
    await token.transfer(omniBridge.address, aliceDepositAmount)

    // WETHをトルネードプールに送信するためのTxを準備
    const transferTx = await token.populateTransaction.transfer(tornadoPool.address, aliceDepositAmount)

    // ブリッジで配列の内のtxを実行
    await omniBridge.execute([
      { who: token.address, callData: transferTx.data }, // ブリッジからプールにERC20をWETHを送信
      { who: tornadoPool.address, callData: onTokenBridgedTx.data }, // プールでonTokenBridgedを実行
    ])

    const aliceWithdrawAmount = utils.parseEther('0.08')
    const aliceEthAddress = '0x4F3f08c789903282803F9a00107E04d18444E94D'

    const aliceChangeUtxo = new Utxo({
      amount: aliceDepositAmount.sub(aliceWithdrawAmount),
      keypair: aliceKeypair,
    })

    // Tx実行
    await transaction({
      tornadoPool,
      inputs: [aliceDepositUtxo],
      outputs: [aliceChangeUtxo],
      recipient: aliceEthAddress,
    })

    const aliceBalance = await token.balanceOf(aliceEthAddress)
    console.log('aliceBalance', aliceBalance.toString())
    expect(aliceBalance).to.be.equal(aliceWithdrawAmount)

    const transactionPoolBalance = await token.balanceOf(tornadoPool.address)
    console.log('transactionPoolBalance', utils.formatEther(transactionPoolBalance))
    expect(transactionPoolBalance).to.be.equal(aliceDepositAmount.sub(aliceWithdrawAmount))

    // L1からdepositすると自動的にL2にブリッジされるため、L1のブリッジには残らない
    const omniBridgeBalance = await token.balanceOf(omniBridge.address)
    console.log('omniBridgeBalance', utils.formatEther(omniBridgeBalance))
    expect(omniBridgeBalance).to.be.equal(0)
  })

  it('[assignment] iii. see assignment doc for details', async () => {
    // [assignment] complete code here
    const { tornadoPool, token, omniBridge } = await loadFixture(fixture)

    // アリスの鍵を作成
    const aliceKeypair = new Keypair()

    // アリスが0.13ETHをデポジットするUTXOを作成
    const aliceDepositAmount = utils.parseEther('0.13')
    const aliceDepositUtxo = new Utxo({ amount: aliceDepositAmount, keypair: aliceKeypair })

    // アリスのデポジットUTXOを準備
    const { args, extData } = await prepareTransaction({
      tornadoPool,
      outputs: [aliceDepositUtxo],
    })

    // アリスのデポジットUTXOをブリッジするためのデータをエンコード
    const onTokenBridgedData = encodeDataForBridge({
      proof: args,
      extData,
    })

    // アリスのデポジットUTXOをブリッジするためのTxを準備
    const onTokenBridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
      token.address,
      aliceDepositUtxo.amount,
      onTokenBridgedData,
    )

    // WETHをオムニブリッジに送信
    await token.transfer(omniBridge.address, aliceDepositAmount)

    // WETHをトルネードプールに送信するためのTxを準備
    const transferTx = await token.populateTransaction.transfer(tornadoPool.address, aliceDepositAmount)

    // ブリッジと入金を実行
    await omniBridge.execute([
      { who: token.address, callData: transferTx.data },
      { who: tornadoPool.address, callData: onTokenBridgedTx.data },
    ])

    // ボブの鍵を作成
    const bobKeypair = new Keypair()
    // ボブのシールドアドレス
    // const bobAddress = bobKeypair.address()

    // アリスがボブに0.06ETHを送金
    const bobSendAmount = utils.parseEther('0.06')
    const bobReceiveUtxo = new Utxo({ amount: bobSendAmount, keypair: bobKeypair })
    const aliceChangeUtxo1 = new Utxo({
      amount: aliceDepositAmount.sub(bobSendAmount),
      keypair: aliceKeypair,
    })

    await transaction({
      tornadoPool,
      inputs: [aliceDepositUtxo],
      outputs: [bobReceiveUtxo, aliceChangeUtxo1],
    })

    const bobEthAddress = '0xDeaD00000000000000000000000000000000BEEf'
    const bobChangeUtxo = new Utxo({ amount: 0, keypair: bobKeypair })

    // ボブが全額を引き出し
    await transaction({
      tornadoPool,
      inputs: [bobReceiveUtxo],
      outputs: [bobChangeUtxo],
      recipient: bobEthAddress,
    })

    // アリスのETHアドレス
    const aliceEthAddress = '0x4F3f08c789903282803F9a00107E04d18444E94D'

    const aliceChangeUtxo2 = new Utxo({
      amount: 0,
      keypair: aliceKeypair,
    })

    // アリスが残額を引き出し
    await transaction({
      tornadoPool,
      inputs: [aliceChangeUtxo1],
      outputs: [aliceChangeUtxo2],
      recipient: aliceEthAddress,
      isL1Withdrawal: true,
    })

    // // 残高の確認
    const bobL2Balance = await token.balanceOf(bobEthAddress)
    const aliceL2Balance = await token.balanceOf(aliceEthAddress)
    const tornadoPoolBalance = await token.balanceOf(tornadoPool.address)
    const omniBridgeBalance = await token.balanceOf(omniBridge.address)

    console.log('Bob L2 balance:', utils.formatEther(bobL2Balance))
    console.log('Alice L2 balance:', utils.formatEther(aliceL2Balance))
    console.log('TornadoPool balance:', utils.formatEther(tornadoPoolBalance))
    console.log('OmniBridge balance:', utils.formatEther(omniBridgeBalance))

    expect(bobL2Balance).to.be.equal(bobSendAmount)
    expect(aliceL2Balance).to.be.equal(0)
    expect(tornadoPoolBalance).to.be.equal(0)
    expect(omniBridgeBalance).to.be.equal(aliceDepositAmount.sub(bobSendAmount))
  })
})
