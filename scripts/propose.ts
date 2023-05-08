import { Signer } from "ethers";
import { ethers } from "hardhat"

export const propose = async () => {
    
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const Token = await ethers.getContractFactory("Token");
    const TimeLock = await ethers.getContractFactory("TimeLock");
    const Treasury = await ethers.getContractFactory("Treasury");
    const Governance = await ethers.getContractFactory("Governance");
    const [executor, proposer, admin, voter1, voter2, voter3, voter4, voter5]: Signer[] = await ethers.getSigners();
    
    let isReleased, funds, blockNumber, proposalState, vote

    const amount = ethers.utils.parseEther('5');

    const token = await Token.deployed()
    await token.connect(voter1).delegate(voter1)
    await token.connect(voter2).delegate(voter2)
    await token.connect(voter3).delegate(voter3)
    await token.connect(voter4).delegate(voter4)
    await token.connect(voter5).delegate(voter5)

    
    const treasury = await Treasury.deployed()

    isReleased = await treasury.isReleased()
    console.log(`Funds released? ${isReleased}`)

    funds = await provider.getBalance(treasury.address)
    console.log(`Funds inside of treasury: ${ethers.utils.formatEther(funds.toString())} ETH\n`)

    const governance = await Governance.deployed()
    const encodedFunction = await treasury.contract.methods.releaseFunds().encodeABI()
    const description = "Release Funds from Treasury"

    const tx = await governance.connect(proposer).propose([treasury.address], [0], [encodedFunction], description)


    const id = tx.logs[0].args.proposalId
    console.log(`Created Proposal: ${id.toString()}\n`)

    proposalState = await governance.state.call(id)
    console.log(`Current state of proposal: ${proposalState.toString()} (Pending) \n`)

    const snapshot = await governance.proposalSnapshot.call(id)
    console.log(`Proposal created on block ${snapshot.toString()}`)

    const deadline = await governance.proposalDeadline.call(id)
    console.log(`Proposal deadline on block ${deadline.toString()}\n`)

    blockNumber = await ethers.eth.getBlockNumber()
    console.log(`Current blocknumber: ${blockNumber}\n`)

    const quorum = await governance.quorum(blockNumber - 1)
    console.log(`Number of votes required to pass: ${ethers.utils.formatEther(quorum.toString(), 'ether')}\n`)

    // Vote
    console.log(`Casting votes...\n`)

    // 0 = Against, 1 = For, 2 = Abstain
    vote = await governance.connect(voter1).castVote(id, 1)
    vote = await governance.connect(voter2).castVote(id, 1)
    vote = await governance.connect(voter3).castVote(id, 1)
    vote = await governance.connect(voter4).castVote(id, 0)
    vote = await governance.connect(voter5).castVote(id, 2)

    // States: Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed
    proposalState = await governance.state.call(id)
    console.log(`Current state of proposal: ${proposalState.toString()} (Active) \n`)

    // NOTE: Transfer serves no purposes, it's just used to fast foward one block after the voting period ends
    await token.connect(executor).transfer(proposer, amount)

    const { againstVotes, forVotes, abstainVotes } = await governance.proposalVotes.call(id)
    console.log(`Votes For: ${ethers.utils.formatEther(forVotes.toString())}`)
    console.log(`Votes Against: ${ethers.utils.formatEther(againstVotes.toString())}`)
    console.log(`Votes Neutral: ${ethers.utils.formatEther(abstainVotes.toString())}\n`)

    blockNumber = await provider.getBlockNumber()
    console.log(`Current blocknumber: ${blockNumber}\n`)

    proposalState = await governance.state.call(id)
    console.log(`Current state of proposal: ${proposalState.toString()} (Succeeded) \n`)

    // Queue 
    const hash = ethers.utils.keccak256("Release Funds from Treasury")
    await governance.queue([treasury.address], [0], [encodedFunction], hash, { from: executor })

    proposalState = await governance.state.call(id)
    console.log(`Current state of proposal: ${proposalState.toString()} (Queued) \n`)

    // Execute
    await governance.execute([treasury.address], [0], [encodedFunction], hash, { from: executor })

    proposalState = await governance.state.call(id)
    console.log(`Current state of proposal: ${proposalState.toString()} (Executed) \n`)

    isReleased = await treasury.isReleased()
    console.log(`Funds released? ${isReleased}`)

    funds = await provider.getBalance(treasury.address)
    console.log(`Funds inside of treasury: ${ethers.utils.formatEther(funds.toString())} ETH\n`)
}