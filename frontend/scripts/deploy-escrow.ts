import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  console.log('='.repeat(70));
  console.log('🚀 AgentMeshEscrow MST Testnet Deployment Script');
  console.log('='.repeat(70));

  const RPC_URL = process.env.MST_RPC_URL || 'https://testnetrpc.mstblockchain.com';
  const EXPECTED_CHAIN_ID = 91562037;

  // 1. Connect to MST Testnet
  console.log(`Connecting to MST RPC: ${RPC_URL}`);
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: EXPECTED_CHAIN_ID,
    name: 'mst-testnet',
  });

  const network = await provider.getNetwork();
  console.log(`Connected Network Chain ID: ${network.chainId.toString()}`);
  if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
    throw new Error(`CRITICAL: Chain ID mismatch! Expected ${EXPECTED_CHAIN_ID}, got ${network.chainId}`);
  }

  // 2. Private Key for deployer
  const privateKey = process.env.MST_DEPLOYER_PRIVATE_KEY || process.env.MST_PLATFORM_PRIVATE_KEY || process.env.MST_ESCROW_PRIVATE_KEY;
  if (!privateKey || !privateKey.startsWith('0x')) {
    console.error('\n❌ ERROR: Deployer private key not found in environment.');
    console.error('Please specify MST_DEPLOYER_PRIVATE_KEY=0x... or MST_PLATFORM_PRIVATE_KEY=0x...');
    console.error('Example:');
    console.error('  $env:MST_DEPLOYER_PRIVATE_KEY="0x..."; npx tsx scripts/deploy-escrow.ts\n');
    process.exit(1);
  }

  const deployer = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer Address: ${deployer.address}`);

  const balance = await provider.getBalance(deployer.address);
  console.log(`Deployer Native Balance: ${ethers.formatEther(balance)} MSTC`);

  if (balance === BigInt(0)) {
    console.error('\n❌ ERROR: Deployer balance is 0 MSTC. Please fund via https://faucet.masterstroke.academy');
    process.exit(1);
  }

  // 3. Load Artifact
  const artifactPath = path.resolve(__dirname, '../src/blockchain/mst/escrow-abi.json');
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Please run compile-escrow.ts first.`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  // 4. Deploy Contract
  console.log('\nDeploying AgentMeshEscrow...');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  // Initial owner set to deployer address
  const contract = await factory.deploy(deployer.address);
  console.log(`Deployment Transaction Hash: ${contract.deploymentTransaction()?.hash}`);
  console.log(`Waiting for confirmation on MST Testnet...`);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();
  const receipt = await deployTx?.wait(1);

  console.log('\n' + '='.repeat(70));
  console.log('✅ AgentMeshEscrow DEPLOYED SUCCESSFULLY TO MST TESTNET!');
  console.log('='.repeat(70));
  console.log(`Contract Name:     AgentMeshEscrow`);
  console.log(`Contract Address:  ${contractAddress}`);
  console.log(`Deployer / Owner:  ${deployer.address}`);
  console.log(`Transaction Hash:  ${deployTx?.hash}`);
  console.log(`Block Number:      ${receipt?.blockNumber}`);
  console.log(`Gas Used:          ${receipt?.gasUsed?.toString()}`);
  console.log(`MSTScan Explorer:  https://testnet.mstscan.com/address/${contractAddress}`);
  console.log('='.repeat(70));

  // 5. Authorize platform wallet as executor if different from deployer
  const platformWallet = process.env.NEXT_PUBLIC_MST_PLATFORM_WALLET || '0x6001712aE72d24Babc386866d035b6d55331E634';
  if (platformWallet.toLowerCase() !== deployer.address.toLowerCase()) {
    try {
      console.log(`\nAuthorizing Platform Executor: ${platformWallet}...`);
      const authTx = await (contract as any).setExecutor(platformWallet, true);
      await authTx.wait(1);
      console.log(`Platform Executor Authorized. Tx: ${authTx.hash}`);
    } catch (authErr) {
      console.warn(`Could not authorize platform executor:`, authErr);
    }
  }

  // 6. Safely update .env and .env.local
  function updateEnvFile(filePath: string) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Update or append NEXT_PUBLIC_MST_ESCROW_CONTRACT
    if (content.includes('NEXT_PUBLIC_MST_ESCROW_CONTRACT=')) {
      content = content.replace(/NEXT_PUBLIC_MST_ESCROW_CONTRACT=.*/g, `NEXT_PUBLIC_MST_ESCROW_CONTRACT=${contractAddress}`);
    } else {
      content += `\nNEXT_PUBLIC_MST_ESCROW_CONTRACT=${contractAddress}\n`;
    }

    // Update or append MST_ESCROW_CONTRACT
    if (content.includes('MST_ESCROW_CONTRACT=')) {
      content = content.replace(/MST_ESCROW_CONTRACT=.*/g, `MST_ESCROW_CONTRACT=${contractAddress}`);
    } else {
      content += `MST_ESCROW_CONTRACT=${contractAddress}\n`;
    }

    // Set settlement mode to escrow
    if (content.includes('MST_SETTLEMENT_MODE=')) {
      content = content.replace(/MST_SETTLEMENT_MODE=.*/g, `MST_SETTLEMENT_MODE=escrow`);
    } else {
      content += `MST_SETTLEMENT_MODE=escrow\n`;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated environment configuration in: ${filePath}`);
  }

  const rootEnv = path.resolve(__dirname, '../../.env');
  const frontendEnv = path.resolve(__dirname, '../.env.local');

  updateEnvFile(rootEnv);
  updateEnvFile(frontendEnv);

  console.log('\nDeployment Complete. System configured to use MST_SETTLEMENT_MODE=escrow.');
}

deploy().catch(err => {
  console.error('\n❌ Deployment failed:', err);
  process.exit(1);
});
