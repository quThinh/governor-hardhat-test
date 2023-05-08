import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
const config: HardhatUserConfig = {
    networks: {
        localhost: {
            url: 'http://127.0.0.1:8545',
            chainId: 1337,
        }
    },
    solidity: {
        compilers: [
            {
                version: "0.8.18",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                        details: {
                            yul: true,
                        },
                    },
                    // viaIR: true,
                },
            },
        ],
    },
};

export default config;
