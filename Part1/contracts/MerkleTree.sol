//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { PoseidonT3 } from "./Poseidon.sol"; //an existing library to perform Poseidon hash on solidity
import "./verifier.sol"; //inherits with the MerkleTreeInclusionProof verifier contract

contract MerkleTree is Groth16Verifier {
    uint256[] public hashes; // the Merkle tree in flattened array form
    uint256 public index = 0; // the current index of the first unfilled leaf
    uint256 public root; // the current Merkle root
    uint256 public n = 3; // the number of levels in the Merkle tree

    constructor() {
        // [assignment] initialize a Merkle tree of 8 with blank leaves
        uint256 numOfMerklePaths = 2**(n+1);
        for (uint256 i = 0; i < numOfMerklePaths; i++) {
            hashes.push(0);
        }
    }

    function insertLeaf(uint256 hashedLeaf) public returns (uint256) {
        // [assignment] insert a hashed leaf into the Merkle tree
        // 現在の空の葉のインデックス
        uint256 currentIndex = index;
        // 葉の最大数
        uint256 maxLeaf = 2**n;
        require(currentIndex < maxLeaf, "Index out of bounds");

        // 新しい葉を追加
        hashes[currentIndex] = hashedLeaf;

        uint256 count = maxLeaf;
        uint256 calculatedIndex = 0;
        // 葉の深さが1になるまで各ブランチでハッシュを計算
        uint256 currentLevel = n - 1;
        for (uint256 i = currentLevel; i > 0; i--) {
            for (uint256 j = 0; j < 2**i; j += 2) {
                hashes[count] = PoseidonT3.poseidon([hashes[calculatedIndex + j], hashes[calculatedIndex + j + 1]]);
                calculatedIndex += 2;
                count++;
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
