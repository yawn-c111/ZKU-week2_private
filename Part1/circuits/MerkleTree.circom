pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

template CheckRoot(n) { // compute the root of a MerkleTree of n Levels 
    signal input leaves[2**n];
    signal output root;

    //[assignment] insert your code here to calculate the Merkle root from 2^n leaves
    var hashersLength = 2**n - 1;
    var hashers[hashersLength];
    
    component poseidons[hashersLength];

    if (n == 0) {
        hashers[0] <== leaves[0];
    } else {
        var count = 0;
        for (var i = 0; i < 2**n; i += 2) {
            poseidons[count] = Poseidon(2);
            poseidons[count].inputs[0] <== leaves[i];
            poseidons[count].inputs[1] <== leaves[i+1];
            hashers[count] <== poseidons[count].out;
            count += 1;
        }
        
        if (n > 1) {
            var newCount = 0;
            for (var i = n - 1; i > 0; i--) { // n = 3 のとき、 i = 2 , 1
                for (var j = 0; j < 2**i; j += 2) { // j = 0 のとき、 j = 0のみ
                    poseidons[count] = Poseidon(2);
                    var tmpCount = newCount+j;
                    poseidons[count].inputs[0] <== hashers[tmpCount];
                    poseidons[count].inputs[1] <== hashers[tmpCount+1];
                    hashers[count] <== poseidons[count].out;
                    newCount += 2;
                    count += 1;
                }
            }
        }
    }

    root === hashers[hashersLength - 1];
}

template MerkleTreeInclusionProof(n) {
    signal input leaf;
    signal input path_elements[n];
    signal input path_index[n]; // path index are 0's and 1's indicating whether the current element is on the left or right
    signal output root; // note that this is an OUTPUT signal

    //[assignment] insert your code here to compute the root from a leaf and elements along the path
    component poseidons[n];
    component mux[n];

    signal hashes[n + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < n; i++) {
        path_index[i] * (1 - path_index[i]) === 0;
        
        poseidons[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][0] <== hashes[i];
        mux[i].c[0][1] <== path_elements[i];

        mux[i].c[1][0] <== path_elements[i];
        mux[i].c[1][1] <== hashes[i];

        mux[i].s <== path_index[i];
        
        poseidons[i].inputs[0] <== mux[i].out[0];
        poseidons[i].inputs[1] <== mux[i].out[1];

        hashes[i + 1] <== poseidons[i].out;
    }

    root <== hashes[n];
}