//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { PoseidonT3 } from "./Poseidon.sol"; //an existing library to perform Poseidon hash on solidity
import "./verifier.sol"; //inherits with the MerkleTreeInclusionProof verifier contract

contract MerkleTree is Groth16Verifier {
    uint256[] public hashes; // the Merkle tree in flattened array form
    uint256 public index = 0; // the current index of the first unfilled leaf
    uint256 public root; // the current Merkle root

    constructor() {
        // [assignment] initialize a Merkle tree of 8 with blank leaves
        hashes = [0, 0, 0, 0, 0, 0, 0, 0];
    }

    function insertLeaf(uint256 hashedLeaf) public returns (uint256) {
        // [assignment] insert a hashed leaf into the Merkle tree
        uint256 currentIndex = index;
        require(currentIndex < 8, "Index out of bounds");

        hashes[currentIndex] = hashedLeaf;

        uint256 count = 8;
        uint256 newCount = 0;
        for (uint256 i = 2; i > 0; i--) {
            for (uint256 j = 0; j < 2**i; j += 2) {
                hashes.push(PoseidonT3.poseidon([hashes[newCount + j], hashes[newCount + j + 1]]));
                newCount += 2;
                count += 1;
            }
        }

        index++;

        return hashes[hashes.length - 1];
    }

    function verify(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata input
    ) public view returns (bool) {
        // [assignment] verify an inclusion proof and check that the proof root matches current root
        bool isValid = verifyProof(a, b, c, input);

        return isValid;
    }
}
