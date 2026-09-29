import { ethers } from 'ethers';

async function inspectMstChain() {
  const provider = new ethers.JsonRpcProvider('https://testnetrpc.mstblockchain.com');
  const latestBlockNum = await provider.getBlockNumber();
  console.log('Latest Block Number:', latestBlockNum);

  // Look back at recent blocks to find real transactions
  let foundTx: string | null = null;
  for (let i = 0; i < 50; i++) {
    const block = await provider.getBlock(latestBlockNum - i, true);
    if (block && block.transactions.length > 0) {
      console.log(`Block ${block.number} has ${block.transactions.length} transactions:`);
      for (const tx of block.transactions) {
        const hashStr = typeof tx === 'string' ? tx : (tx as { hash: string }).hash;
        console.log(' - Tx Hash:', hashStr);
        foundTx = hashStr;
      }
      if (foundTx) break;
    }
  }

  if (foundTx) {
    console.log('\nInspecting real transaction:', foundTx);
    const tx = await provider.getTransaction(foundTx);
    console.log('Transaction details:', {
      hash: tx?.hash,
      from: tx?.from,
      to: tx?.to,
      value: tx?.value ? ethers.formatEther(tx.value) : '0',
      blockNumber: tx?.blockNumber,
      chainId: tx?.chainId?.toString(),
    });

    const receipt = await provider.getTransactionReceipt(foundTx);
    console.log('Receipt details:', {
      status: receipt?.status,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed.toString(),
      confirmations: (await receipt?.confirmations()) || 1,
    });
  }
}

inspectMstChain().catch(console.error);
