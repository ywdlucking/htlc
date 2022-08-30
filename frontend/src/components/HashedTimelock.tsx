import { useWeb3React } from '@web3-react/core';
import { Contract, ethers, Signer } from 'ethers';
import Crypoto from '../utils/CryptoJS';
import {
  ChangeEvent,
  MouseEvent,
  ReactElement,
  useEffect,
  useState
} from 'react';
import styled from 'styled-components';
import HashedTimelockArtifact from '../artifacts/contracts/HashedTimelock.sol/HashedTimelock.json';
import { Provider } from '../utils/provider';
import { SectionDivider } from './SectionDivider';
import { rmSync } from 'fs';

const StyledDeployContractButton = styled.button`
  width: 180px;
  height: 2rem;
  border-radius: 1rem;
  border-color: blue;
  cursor: pointer;
  place-self: center;
`;

const StyledGreetingDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-columns: 135px 2.7fr 1fr;
  grid-gap: 10px;
  place-self: center;
  align-items: center;
`;

const StyledLabel = styled.label`
  font-weight: bold;
`;

const StyledInput = styled.input`
  padding: 0.4rem 0.6rem;
  line-height: 2fr;
`;

const StyledButton = styled.button`
  width: 150px;
  height: 2rem;
  border-radius: 1rem;
  border-color: blue;
  cursor: pointer;
`;

export function HashedTimelock(): ReactElement {
  const context = useWeb3React<Provider>();
  const { library, active } = context;

  const [signer, setSigner] = useState<Signer>();
  const [HashedTimelockContract, setHashedTimelockContract] = useState<Contract>();
  const [HashedTimelockContractAddr, setHashedTimelockContractAddr] = useState<string>('');

  const [HTLCID, setHTLCID] = useState<string>('');
  const [HASHVALUE, setHASHVALUE] = useState<string>('');
  const [htlcInput, sethtlcInput] = useState<string>('');
  const [withdrawInput, setwithdrawInput] = useState<string>('');
  const [refundInput, setrefundInput] = useState<string>('');

  const cry = new Crypoto();
  const ONE_YEAR_IN_SECS = 24 * 60 * 60;
  const ONE_GWEI = 10_000_000_000;

  useEffect((): void => {
    if (!library) {
      setSigner(undefined);
      return;
    }

    setSigner(library.getSigner());
  }, [library]);

  // useEffect((): void => {
  //   if (!HashedTimelockContract) {
  //     return;
  //   }

  //   async function getGreeting(HashedTimelockContract: Contract): Promise<void> {
  //     const _greeting = await HashedTimelockContract.greet();

  //     if (_greeting !== greeting) {
  //       setGreeting(_greeting);
  //     }
  //   }

  //   getGreeting(HashedTimelockContract);
  // }, [HashedTimelockContract, greeting]);

  function handleDeployContract(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    // only deploy the HashedTimelock contract one time, when a signer is defined
    if (HashedTimelockContract || !signer) {
      return;
    }

    async function deployHashedTimelockContract(signer: Signer): Promise<void> {
      const HashedTimelock = new ethers.ContractFactory(
        HashedTimelockArtifact.abi,
        HashedTimelockArtifact.bytecode,
        signer
      );

      try {
        const HashedTimelockContract = await HashedTimelock.deploy();

        await HashedTimelockContract.deployed();


        setHashedTimelockContract(HashedTimelockContract);

        window.alert(`HashedTimelock deployed to: ${HashedTimelockContract.address}`);

        setHashedTimelockContractAddr(HashedTimelockContract.address);
      } catch (error: any) {
        window.alert(
          'Error!' + (error && error.message ? `\n\n${error.message}` : '')
        );
      }
    }

    deployHashedTimelockContract(signer);
  }

  function handleGreetingChange(event: ChangeEvent<HTMLInputElement>): void {
    event.preventDefault();
    sethtlcInput(event.target.value);
  }

  function handleWithdrawChange(event: ChangeEvent<HTMLInputElement>): void {
    event.preventDefault();
    setwithdrawInput(event.target.value);
  }

  function handleRefundChange(event: ChangeEvent<HTMLInputElement>): void {
    event.preventDefault();
    setrefundInput(event.target.value);
  }

  function handleNewHTLCSubmit(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();

    if (!HashedTimelockContract) {
      window.alert('Undefined HashedTimelockContract');
      return;
    }

    if (!signer) {
      window.alert('Undefined signer');
      return;
    }

    if (!htlcInput) {
      window.alert('htlcInput cannot be empty');
      return;
    }

    async function submitNewHTLC(signer: Signer, HashedTimelockContract: Contract): Promise<void> {
      try {
        console.log("htlcInput:", htlcInput)
        const inputA = htlcInput.split(",");
        const receiver = inputA[0];
        const falg = inputA[2];
        let hash = inputA[1];
        if(falg === "0") {
          hash = "0x" + cry.sha256(inputA[1])
        }

        const lockedAmount = "15";

        const now = Date.parse (new Date ().toString())
        const unlockTime = now + ONE_YEAR_IN_SECS;
        const sender = await signer.getAddress().then((rs) => {return rs;});
        console.log("newHTLC:", receiver,hash,unlockTime, sender,lockedAmount)
        const setTxn = await HashedTimelockContract.newHTLC(receiver, hash, unlockTime, {from: sender, value: ethers.utils.parseEther(lockedAmount)});

        const tx = await setTxn.wait();
        const htlcId = tx.events[0].topics[1];
        console.log("HTLCID:", htlcId)
        setHASHVALUE(hash);
        setHTLCID(htlcId);
      } catch (error: any) {
        window.alert(
          'Error!' + (error && error.message ? `\n\n${error.message}` : '')
        );
      }
    }

    submitNewHTLC(signer, HashedTimelockContract);
  }

  function handleWithdrawSubmit(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();

    if (!HashedTimelockContract) {
      window.alert('Undefined HashedTimelockContract');
      return;
    }

    if (!signer) {
      window.alert('Undefined signer');
      return;
    }

    if (!withdrawInput) {
      window.alert('withdrawInput cannot be empty');
      return;
    }

    async function submitWithdraw(signer: Signer, HashedTimelockContract: Contract): Promise<void> {
      try {
        console.log("withdrawInput:", withdrawInput)
        const inputA = withdrawInput.split(",");
        if(inputA.length != 2) {
          window.alert('withdrawInput error');
          return;
        }
        console.log("withdraw:", inputA[0], inputA[1])
        const bytes = cry.tobytes(inputA[1])

        const preimage = bytes.map(function(byte){return (byte & 0xFF).toString(16)}).join('');
        console.log("preimage:", preimage)
        const setTxn = await HashedTimelockContract.withdraw(inputA[0], "0x"+preimage);

        console.log("setTxn:", setTxn)

        window.alert('withdraw success');
      } catch (error: any) {
        window.alert(
          'Error!' + (error && error.message ? `\n\n${error.message}` : '')
        );
      }
    }

    submitWithdraw(signer, HashedTimelockContract);
  }

  function handleRefundSubmit(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();

    if (!HashedTimelockContract) {
      window.alert('Undefined HashedTimelockContract');
      return;
    }

    if (!signer) {
      window.alert('Undefined signer');
      return;
    }

    if (!refundInput) {
      window.alert('refundInput cannot be empty');
      return;
    }

    async function submitRefund(signer: Signer, HashedTimelockContract: Contract): Promise<void> {
      try {
        console.log("refundInput:", refundInput)

        const setTxn = await HashedTimelockContract.refund(refundInput);

        console.log("setTxn:", setTxn)

        window.alert('refund success');
      } catch (error: any) {
        window.alert(
          'Error!' + (error && error.message ? `\n\n${error.message}` : '')
        );
      }
    }

    submitRefund(signer, HashedTimelockContract);
  }
  

  return (
    <>
      <StyledDeployContractButton
        disabled={!active || HashedTimelockContract ? true : false}
        style={{
          cursor: !active || HashedTimelockContract ? 'not-allowed' : 'pointer',
          borderColor: !active || HashedTimelockContract ? 'unset' : 'blue'
        }}
        onClick={handleDeployContract}
      >
        Deploy HashedTimelock Contract
      </StyledDeployContractButton>
      <SectionDivider />
      <StyledGreetingDiv>
        <StyledLabel>Contract addr</StyledLabel>
        <div>
          {HashedTimelockContractAddr ? (
            HashedTimelockContractAddr
          ) : (
            <em>{`<Contract not yet deployed>`}</em>
          )}
        </div>
        {/* empty placeholder div below to provide empty first row, 3rd col div for a 3x4 grid */}
        <div></div>
        <StyledLabel>Current hashID</StyledLabel>
        <div>
          {HTLCID ? HTLCID : <em>{`<HashedTimelock not yet created>`}</em>}
        </div>
        {/* empty placeholder div below to provide empty first row, 3rd col div for a 3x4 grid */}
        <div></div>
        <StyledLabel>HASHVALUE</StyledLabel>
        <div>
          {HASHVALUE ? HASHVALUE : <em>{`<HashedTimelock not yet created>`}</em>}
        </div>
        {/* empty placeholder div below to provide empty first row, 3rd col div for a 3x4 grid */}
        <div></div>
        <StyledLabel htmlFor="htlcInput">new HashedTimelock</StyledLabel>
        <StyledInput
          id="htlcInput"
          type="text"
          placeholder={'<receiver, skey>'}
          onChange={handleGreetingChange}
          style={{ fontStyle: HTLCID ? 'normal' : 'italic' }}
        ></StyledInput>
        <StyledButton
          disabled={!active || !HashedTimelockContract ? true : false}
          style={{
            cursor: !active || !HashedTimelockContract ? 'not-allowed' : 'pointer',
            borderColor: !active || !HashedTimelockContract ? 'unset' : 'blue'
          }}
          onClick={handleNewHTLCSubmit}
        >
          Submit
        </StyledButton>
      </StyledGreetingDiv>
      <SectionDivider />
      <StyledGreetingDiv>
        {/* empty placeholder div below to provide empty first row, 3rd col div for a 3x4 grid */}
        <StyledLabel htmlFor="withdrawInput">Withdraw</StyledLabel>
        <StyledInput
          id="withdrawInput"
          type="text"
          placeholder={'<htlcID, preimage>'}
          onChange={handleWithdrawChange}
          style={{ fontStyle: HTLCID ? 'normal' : 'italic' }}
        ></StyledInput>
        <StyledButton
          disabled={!active || !HashedTimelockContract ? true : false}
          style={{
            cursor: !active || !HashedTimelockContract ? 'not-allowed' : 'pointer',
            borderColor: !active || !HashedTimelockContract ? 'unset' : 'blue'
          }}
          onClick={handleWithdrawSubmit}
        >
          Submit
        </StyledButton>
      </StyledGreetingDiv>
      <SectionDivider />
      <StyledGreetingDiv>
        <StyledLabel htmlFor="refundInput">Refund</StyledLabel>
        <StyledInput
          id="refundInput"
          type="text"
          placeholder={'<htlcID>'}
          onChange={handleRefundChange}
          style={{ fontStyle: HTLCID ? 'normal' : 'italic' }}
        ></StyledInput>
        <StyledButton
          disabled={!active || !HashedTimelockContract ? true : false}
          style={{
            cursor: !active || !HashedTimelockContract ? 'not-allowed' : 'pointer',
            borderColor: !active || !HashedTimelockContract ? 'unset' : 'blue'
          }}
          onClick={handleRefundSubmit}
        >
          Submit
        </StyledButton>
      </StyledGreetingDiv>
    </>
  );
}
