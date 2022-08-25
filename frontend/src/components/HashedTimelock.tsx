import { useWeb3React } from '@web3-react/core';
import { Contract, ethers, Signer } from 'ethers';
import { createHash } from 'crypto';
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
  const [greetingInput, setGreetingInput] = useState<string>('');

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
    setGreetingInput(event.target.value);
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

    if (!greetingInput) {
      window.alert('Greeting cannot be empty');
      return;
    }

    async function submitNewHTLC(signer: Signer, HashedTimelockContract: Contract): Promise<void> {
      try {
        const inputA = greetingInput.split(",");
        const receiver = inputA[0];
        const hash = newHash(inputA[1])


        const lockedAmount = ONE_GWEI;

        const now = Date.parse (new Date ().toString())
        const unlockTime = now + ONE_YEAR_IN_SECS;
        const sender = signer.getAddress();
        const setTxn = await HashedTimelockContract.newHTLC(receiver, hash, unlockTime, {from: sender, value: lockedAmount});


        const tx = await setTxn.wait();
        window.alert(`Success!\n\nGreeting is now: ${tx}`);

        setHTLCID(tx);
      } catch (error: any) {
        window.alert(
          'Error!' + (error && error.message ? `\n\n${error.message}` : '')
        );
      }
    }

    submitNewHTLC(signer, HashedTimelockContract);
  }

  function sha256(x:string) :string{
    return createHash('sha256').update(x).digest('hex');
  }

  //create hash pair
  function newHash(preimage:string) : string{
    return sha256(preimage);
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
        {/* empty placeholder div below to provide empty first row, 3rd col div for a 2x3 grid */}
        <div></div>
        <StyledLabel>Current hashID</StyledLabel>
        <div>
          {HTLCID ? HTLCID : <em>{`<HashedTimelock not yet created>`}</em>}
        </div>
        {/* empty placeholder div below to provide empty first row, 3rd col div for a 2x3 grid */}
        <div></div>
        <StyledLabel htmlFor="greetingInput">new HashedTimelock</StyledLabel>
        <StyledInput
          id="greetingInput"
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
    </>
  );
}
