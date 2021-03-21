// SPDX-License-Identifier: MIT
pragma solidity ^0.7.3;
contract Hashchain {
  mapping (string => string) public prev;
  mapping (string => string) public next;
  event Add(string prev, string current);
  function add(string memory p, string memory c) public {
    prev[c] = p;
    next[p] = c;
    emit Add(p, c);
  }
}
