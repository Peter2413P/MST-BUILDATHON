import fs from 'fs';
import path from 'path';
// @ts-ignore
import solc from 'solc';

console.log('='.repeat(60));
console.log('Compiling AgentMeshEscrow.sol with solc...');
console.log('='.repeat(60));

const contractPath = path.resolve(__dirname, '../../contracts/AgentMeshEscrow.sol');
console.log('Reading contract source from:', contractPath);
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'AgentMeshEscrow.sol': {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let hasError = false;
  for (const err of output.errors) {
    if (err.severity === 'error') {
      hasError = true;
      console.error('❌ Compilation Error:', err.formattedMessage);
    } else {
      console.warn('⚠️ Warning:', err.formattedMessage);
    }
  }
  if (hasError) {
    process.exit(1);
  }
}

const contract = output.contracts['AgentMeshEscrow.sol']['AgentMeshEscrow'];
const abi = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;

console.log(`✅ Compilation successful!`);
console.log(`   ABI methods count: ${abi.length}`);
console.log(`   Bytecode length: ${bytecode.length} hex chars`);

const outputDir = path.resolve(__dirname, '../src/blockchain/mst');
const outputPath = path.join(outputDir, 'escrow-abi.json');

const artifact = {
  contractName: 'AgentMeshEscrow',
  abi,
  bytecode,
  compiledAt: new Date().toISOString(),
  compiler: solc.version(),
};

fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');
console.log(`📁 Artifact written to: ${outputPath}`);
