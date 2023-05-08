import { ethers } from "hardhat";
import { Signer } from "ethers";
import { propose } from "./propose"
import { Treasury, TimeLock, Token, Governance, Token__factory } from "../typechain-types";

async function main() {
  let quorum = 5 // Percentage of total supply of tokens needed to aprove proposals (5%)
  const votingDelay = 0 // How many blocks after proposal until voting becomes active
  const votingPeriod = 5 // How many blocks to allow voters to vote
  const minDelay = 1; // How long do we have to wait until we can execute after a passed proposal
  const [executor, proposer, admin, voter1, voter2, voter3, voter4, voter5]: Signer[] = await ethers.getSigners();
  // const executor = await accounts[0].getAddress();
  // const proposer = await accounts[1].getAddress();
  // const admin = await accounts[7].getAddress();
  // const voter1 = await accounts[2].getAddress();
  // const voter2 = await accounts[3].getAddress();
  // const voter3 = await accounts[4].getAddress();
  // const voter4 = await accounts[5].getAddress();
  // const voter5 = await accounts[6].getAddress();
  const Token: Token__factory = await ethers.getContractFactory("Token");
  const TimeLock = await ethers.getContractFactory("TimeLock");
  const Treasury = await ethers.getContractFactory("Treasury");
  const Governance = await ethers.getContractFactory("Governance");

  const token: Token = await Token.deploy("WDT", "WDT", 50);
  const timelock: TimeLock = await TimeLock.deploy(minDelay, [await proposer.getAddress()], [await executor.getAddress()], await admin.getAddress());
  let funds = ethers.utils.parseEther('25');
  const treasury: Treasury = await Treasury.deploy(await executor.getAddress(), { value: funds })

  const governance: Governance = await Governance.deploy(token.address, timelock.address, quorum, votingDelay, votingPeriod);

  await treasury.transferOwnership(timelock.address)

  const amountMint = ethers.utils.parseEther('50')
  await token.connect(executor).mintFor(await voter1.getAddress(), amountMint)
  await token.connect(executor).mintFor(await voter2.getAddress(), amountMint)
  await token.connect(executor).mintFor(await voter3.getAddress(), amountMint)
  await token.connect(executor).mintFor(await voter4.getAddress(), amountMint)
  await token.connect(executor).mintFor(await voter5.getAddress(), amountMint)
  const proposerRole = await timelock.PROPOSER_ROLE()
  const executorRole = await timelock.EXECUTOR_ROLE()
  await timelock.connect(admin).grantRole(proposerRole, governance.address)
  await timelock.connect(admin).grantRole(executorRole, governance.address)


  const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
  let isReleased, blockNumber, proposalState, vote;

  const amount = ethers.utils.parseEther('0.00001');

  await token.connect(voter1).delegate(await voter1.getAddress())
  await token.connect(voter2).delegate(await voter2.getAddress())
  await token.connect(voter3).delegate(await voter3.getAddress())
  await token.connect(voter4).delegate(await voter4.getAddress())
  await token.connect(voter5).delegate(await voter5.getAddress())
  isReleased = await treasury.isReleased()
  console.log(`Funds released? ${isReleased}`)

  funds = await ethers.provider.getBalance(treasury.address)
  console.log(`Funds inside of treasury: ${ethers.utils.formatEther(funds.toString())} ETH\n`)

  const encodedFunction = treasury.interface.encodeFunctionData("releaseFunds");
  const description = "Release Funds from Treasury"

  const tx = await governance.connect(proposer).propose([treasury.address], [0], [encodedFunction], description)

  // await tx.wait();
  // const id = tx.wait.logs[0].args.proposalId
  const receipt = await tx.wait(); // Wait for transaction confirmation
  const events = receipt.events;
  let id;
  if (events && events.length > 0) {
    id = events[0].args?.proposalId;
    console.log(`Created Proposal: ${id.toString()}\n`);
  } else {
    console.log("Transaction did not emit any events.");
  }

  proposalState = await governance.state(id);
  console.log(`Current state of proposal: ${proposalState.toString()} (Pending) \n`)

  const snapshot = await governance.proposalSnapshot(id)
  console.log(`Proposal created on block ${snapshot.toString()}`)

  const deadline = await governance.proposalDeadline(id)
  console.log(`Proposal deadline on block ${deadline.toString()}\n`)

  blockNumber = await provider.getBlockNumber()
  console.log(`Current blocknumber: ${blockNumber}\n`)

  let quorumTemp = await governance.quorum(blockNumber - 1)
  console.log(`Number of votes required to pass: ${ethers.utils.formatEther(quorumTemp.toString())}\n`)

  // Vote
  console.log(`Casting votes...\n`)

  // 0 = Against, 1 = For, 2 = Abstain
  vote = await governance.connect(voter1).castVote(id, 1)
  vote = await governance.connect(voter2).castVote(id, 1)
  vote = await governance.connect(voter3).castVote(id, 1)
  vote = await governance.connect(voter4).castVote(id, 0)
  vote = await governance.connect(voter5).castVote(id, 2)

  // States: Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed
  proposalState = await governance.state(id)
  console.log(`Current state of proposal: ${proposalState.toString()} (Active) \n`)

  // NOTE: Transfer serves no purposes, it's just used to fast foward one block after the voting period ends
  await token.mintFor(await executor.getAddress(), "10000000000000000000000")
  await token.connect(executor).transfer(await proposer.getAddress(), amount)

  const { againstVotes, forVotes, abstainVotes } = await governance.proposalVotes(id)
  console.log(`Votes For: ${ethers.utils.formatEther(forVotes.toString())}`)
  console.log(`Votes Against: ${ethers.utils.formatEther(againstVotes.toString())}`)
  console.log(`Votes Neutral: ${ethers.utils.formatEther(abstainVotes.toString())}\n`)

  blockNumber = await provider.getBlockNumber()
  console.log(`Current blocknumber: ${blockNumber}\n`)

  proposalState = await governance.state(id)
  console.log(`Current state of proposal: ${proposalState.toString()} (Succeeded) \n`)

  // Queue 
  const dataBytes = ethers.utils.toUtf8Bytes("Release Funds from Treasury");
  const hash = ethers.utils.keccak256(dataBytes)
  console.log(hash)
  await governance.connect(executor).queue([treasury.address], [0], [encodedFunction], hash)
  console.log(hash)

  proposalState = await governance.state(id)
  console.log(`Current state of proposal: ${proposalState.toString()} (Queued) \n`)

  // Execute
  await governance.connect(executor).execute([treasury.address], [0], [encodedFunction], hash)

  proposalState = await governance.state(id)
  console.log(`Current state of proposal: ${proposalState.toString()} (Executed) \n`)

  isReleased = await treasury.isReleased()
  console.log(`Funds released? ${isReleased}`)

  funds = await provider.getBalance(treasury.address)
  console.log(`Funds inside of treasury: ${ethers.utils.formatEther(funds.toString())} ETH\n`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
