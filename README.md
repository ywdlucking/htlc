# htlc

## Project setup
```
npm install
```

## contract

##compiling your contracts
```
npx hardhat compile
```

### deploy

```
ywd@ubuntu:~/workspace/vue3/htlc$ npx hardhat run scripts/deploy.js
Lock deployed to 0x5FbDB2315678afecb367f032d93F642f64180aa3

```

### test
```
ywd@ubuntu:~/workspace/vue3/htlc$ npx hardhat test


  HTLC
    Deployment
      ✔ Should set the right unlockTime (1397ms)
    HashedTimeLock
      newHTLC() test
        ✔ Should create newHTLC (130ms)
        ✔ Should return error when create newHTLC with incorrect args (57ms)
        ✔ Should return error when create newHTLC with timelocks in the past (39ms)
        ✔ Should return error when create newHTLC with same preimage (104ms)
      withdraw() test
        ✔ Should success to extract the locked asset (121ms)
        ✔ Should return error when hashlock hash does not match (63ms)
        ✔ Should return error when already withdrawn (88ms)
        ✔ Should return error when timeout (3054ms)
      refund() test
        ✔ Should sender calls this method to retrieve the locked asset (3085ms)
        ✔ Should return error when already refunded (3087ms)
        ✔ Should return error when already withdrawn (5088ms)
        ✔ Should return error when timelock not yet passed (2052ms)


  13 passing (18s)

```

## Getting started

### Prepare Enviroment


#### step 1. start A and B blockchain


```
# a blockchain
npx hardhat node --port 8545
```

```
# b blockchain
npx hardhat node --port 9545
```