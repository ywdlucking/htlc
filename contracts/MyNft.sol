//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract MyNft is ERC721PresetMinterPauserAutoId {
    constructor()
        ERC721PresetMinterPauserAutoId("Frank Cat", "FCAT", "https://www.frank.hk/token/")
    {
    }

    // This allows the minter to update the tokenURI after it's been minted.
	  // To disable this, delete this function.
	  function setTokenURI(uint256 tokenId, string memory tokenURI) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "web3 CLI: must have minter role to update tokenURI");

        setTokenURI(tokenId, tokenURI);
    }
}