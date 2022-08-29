//SPDX-License-Identifier: Unlicense
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AKToken is ERC20 {
  constructor(uint256 initialSupply) 
    ERC20("AKToken", "AKT") 
  {
      _mint(msg.sender, initialSupply);
  }
}