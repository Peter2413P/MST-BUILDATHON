import { ethers } from 'ethers';

async function probeMstRpc() {
  const rpcUrl = 'https://testnetrpc.mstblockchain.com';
  console.log('Connecting to MST RPC:', rpcUrl);

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    const network = await provider.getNetwork();
    console.log('Network Chain ID:', network.chainId.toString());

    const blockNumber = await provider.getBlockNumber();
    console.log('Latest Block Number:', blockNumber);

    const platformWallet = '0x6001712aE72d24Babc386866d035b6d55331E634';
    const balance = await provider.getBalance(platformWallet);
    console.log(`Platform Wallet (${platformWallet}) Balance:`, ethers.formatEther(balance), 'MSTC');

    // Also check the user wallet from previous request if any: 0xF29b3fe8cb2D49060639ed2b6235a78ab8df2c61
    const userWallet = '0xF29b3fe8cb2D49060639ed2b6235a78ab8df2c61';
    const userBalance = await provider.getBalance(userWallet);
    console.log(`User Wallet (${userWallet}) Balance:`, ethers.formatEther(userBalance), 'MSTC');
  } catch (err) {
    console.error('RPC probe error:', err);
  }
}

probeMstRpc();
