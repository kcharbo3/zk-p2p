import React, { useEffect, useState } from 'react';
import styled from 'styled-components/macro'
import { ArrowLeft } from 'react-feather';
import { CircuitType } from '@zkp2p/circuits-circom/scripts/generate_input';
import {
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from 'wagmi'

import { TitleCenteredRow } from '../layouts/Row'
import { ThemedText } from '../../theme/text'
import { ProofGenerationForm } from "../ProofGen/ProofForm";
import { LabeledSwitch } from "../common/LabeledSwitch";
import { RECEIVE_KEY_FILE_NAME, RemoteProofGenEmailTypes  } from "@helpers/constants";
import { PROVING_TYPE_TOOLTIP, PROOF_FORM_RECEIVE_INSTRUCTIONS } from "@helpers/tooltips";
import { reformatProofForChain } from "@helpers/submitProof";
import useProofGenSettings from '@hooks/useProofGenSettings';
import useSmartContracts from '@hooks/useSmartContracts';
import useDeposits from '@hooks/useDeposits';


interface OffRampProps {
  handleBackClick: () => void;
  selectedIntentHash: string;
}
 
export const OffRamp: React.FC<OffRampProps> = ({
  handleBackClick,
  selectedIntentHash
}) => {
  /*
   * Context
   */

  const { isProvingTypeFast, setIsProvingTypeFast } = useProofGenSettings();
  const {
    rampAddress,
    rampAbi,
    receiveProcessorAddress,
    receiveProcessorAbi,
  } = useSmartContracts()

  const {
    refetchDepositIntents
  } = useDeposits()

  /*
   * State
   */

  const [shouldConfigureOnRampWrite, setShouldConfigureOnRampWrite] = useState<boolean>(false);
  const [shouldFetchVerifyProof, setShouldFetchVerifyProof] = useState<boolean>(false);

  // ----- transaction state -----
  const [proof, setProof] = useState<string>('');
  // const [proof, setProof] = useState<string>(
  //   JSON.stringify()
  // );
  
  const [publicSignals, setPublicSignals] = useState<string>('');
  // const [publicSignals, setPublicSignals] = useState<string>(
  //   JSON.stringify()
  // );

  /*
   * Contract Reads
   */

  const {
    data: verifyProofRaw,
  } = useContractRead({
    address: receiveProcessorAddress,
    abi: receiveProcessorAbi,
    functionName: "verifyProof",
    args: [
      ...reformatProofForChain(proof),
      publicSignals ? JSON.parse(publicSignals) : null,
    ],
    enabled: shouldFetchVerifyProof
  });

  /*
   * Contract Writes
   */

  //
  // new: onRampWithConvenience(uint256[2] memory _a, uint256[2][2] memory _b, uint256[2] memory _c, uint256[9] memory _signals)
  //
  const { config: writeCompleteOrderConfig } = usePrepareContractWrite({
    address: rampAddress,
    abi: rampAbi,
    functionName: 'onRampWithConvenience',
    args: [
      ...reformatProofForChain(proof),
      publicSignals ? JSON.parse(publicSignals) : null,
    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
    enabled: shouldConfigureOnRampWrite
  });

  const {
    data: submitOnRampWithConvenienceResult,
    isLoading: isWriteCompleteOrderLoading,
    writeAsync: writeCompleteOrderAsync
  } = useContractWrite(writeCompleteOrderConfig);

  const {
    isLoading: isSubmitOnRampWithConvenienceMining
  } = useWaitForTransaction({
    hash: submitOnRampWithConvenienceResult ? submitOnRampWithConvenienceResult.hash : undefined,
    onSuccess(data) {
      console.log('writeSubmitOnRampWithConvenience successful: ', data);
      
      refetchDepositIntents?.();
    },
  });

  /*
   * Handlers
   */

  const handleProvingTypeChanged = (checked: boolean) => {
    if (setIsProvingTypeFast) {
      setIsProvingTypeFast(checked);
    }
  };

  const handleWriteCompleteOrderClick = async () => {
    try {
      await writeCompleteOrderAsync?.();
    } catch (error) {
      console.log('writeCompleteOrderAsync failed: ', error);
    }
  }

  /*
   * Hooks
   */

  useEffect(() => {
    if (proof && publicSignals) {
      // console.log("proof", proof);
      // console.log("public signals", publicSignals);
      // console.log("vkey", vkey);

      // const proofVerified = await snarkjs.groth16.verify(vkey, JSON.parse(publicSignals), JSON.parse(proof));
      // console.log("proofVerified", proofVerified);

      setShouldFetchVerifyProof(true);
    } else {
      setShouldFetchVerifyProof(false);
    }
  }, [proof, publicSignals]);

  useEffect(() => {
    if (verifyProofRaw) {
      setShouldConfigureOnRampWrite(true);
    } else {
      setShouldConfigureOnRampWrite(false);
    }
  }, [verifyProofRaw]);

  /*
    Component
  */

  return (
    <Container>
      <TitleCenteredRow style={{ paddingBottom: '1.5rem' }}>
        <button
          onClick={handleBackClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <StyledArrowLeft/>
        </button>

        <ThemedText.HeadlineSmall style={{ flex: '1', margin: 'auto', textAlign: 'center' }}>
          Complete Off-Ramp
        </ThemedText.HeadlineSmall>

        <LabeledSwitch
          switchChecked={isProvingTypeFast ?? true}
          onSwitchChange={handleProvingTypeChanged}
          checkedLabel={"Fast"}
          uncheckedLabel={"Private"}
          helperText={PROVING_TYPE_TOOLTIP}
        />
      </TitleCenteredRow>

      <Body>
        <ProofGenerationForm
          instructions={PROOF_FORM_RECEIVE_INSTRUCTIONS}
          circuitType={CircuitType.EMAIL_VENMO_RECEIVE}
          circuitRemoteFilePath={RECEIVE_KEY_FILE_NAME}
          circuitInputs={selectedIntentHash}
          remoteProofGenEmailType={RemoteProofGenEmailTypes.RECEIVE}
          proof={proof}
          publicSignals={publicSignals}
          setProof={setProof}
          setPublicSignals={setPublicSignals}
          isSubmitProcessing={isWriteCompleteOrderLoading || isSubmitOnRampWithConvenienceMining}
          handleSubmitVerificationClick={handleWriteCompleteOrderClick}
        />
      </Body>
    </Container>
  );
};

const Container = styled.div`
  padding: 1.5rem;
  background-color: #0D111C;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const StyledArrowLeft = styled(ArrowLeft)`
  color: #FFF;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-self: flex-start;
  justify-content: center;
`;
