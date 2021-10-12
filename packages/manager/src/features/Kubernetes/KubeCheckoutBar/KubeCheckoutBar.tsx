import * as React from 'react';
import CheckoutBar from 'src/components/CheckoutBar';
import Divider from 'src/components/core/Divider';
import Notice from 'src/components/Notice';
import renderGuard from 'src/components/RenderGuard';
import useFlags from 'src/hooks/useFlags';
import EUAgreementCheckbox from 'src/features/Account/Agreements/EUAgreementCheckbox';
import { ExtendedType } from 'src/store/linodeType/linodeType.reducer';
import { isEURegion } from 'src/utilities/formatRegion';
import { getTotalClusterPrice, nodeWarning } from '../kubeUtils';
import { PoolNodeWithPrice } from '../types';
import HACheckbox from './HACheckbox';
import NodePoolSummary from './NodePoolSummary';
import { useProfile } from 'src/queries/profile';
import { useAccountAgreements } from 'src/queries/accountAgreements';

export interface Props {
  pools: PoolNodeWithPrice[];
  submitting: boolean;
  typesData: ExtendedType[];
  createCluster: () => void;
  updatePool: (poolIdx: number, updatedPool: PoolNodeWithPrice) => void;
  removePool: (poolIdx: number) => void;
  highAvailability: boolean;
  setHighAvailability: (ha: boolean) => void;
  region: string | undefined;
  hasAgreed: boolean;
  toggleHasAgreed: () => void;
}

export const KubeCheckoutBar: React.FC<Props> = (props) => {
  const {
    pools,
    submitting,
    createCluster,
    removePool,
    typesData,
    updatePool,
    highAvailability,
    setHighAvailability,
    region,
    hasAgreed,
    toggleHasAgreed,
  } = props;

  const flags = useFlags();

  // @todo I don't think the API returns the HA price, how should we go about this? Add it to the constants, feature flag?
  const haPrice = 100;

  // Show a warning if any of the pools have fewer than 3 nodes
  const showWarning = pools.some((thisPool) => thisPool.count < 3);

  const { data: profile } = useProfile();
  const { data: agreements } = useAccountAgreements();
  const showGDPRCheckbox =
    isEURegion(region) &&
    !profile?.restricted &&
    agreements?.eu_model === false;

  const needsAPool = pools.length < 1;
  const disableCheckout = Boolean(
    needsAPool || (!hasAgreed && showGDPRCheckbox)
  );

  return (
    <CheckoutBar
      data-qa-checkout-bar
      heading="Cluster Summary"
      calculatedPrice={getTotalClusterPrice(
        pools,
        highAvailability ? haPrice : undefined
      )}
      isMakingRequest={submitting}
      disabled={disableCheckout}
      onDeploy={createCluster}
      submitText={'Create Cluster'}
      agreement={
        showGDPRCheckbox ? (
          <EUAgreementCheckbox checked={hasAgreed} onChange={toggleHasAgreed} />
        ) : undefined
      }
    >
      <>
        {pools.map((thisPool, idx) => (
          <NodePoolSummary
            key={idx}
            nodeCount={thisPool.count}
            updateNodeCount={(updatedCount: number) =>
              updatePool(idx, { ...thisPool, count: updatedCount })
            }
            onRemove={() => removePool(idx)}
            price={thisPool.totalMonthlyPrice}
            poolType={
              typesData.find((thisType) => thisType.id === thisPool.type) ||
              null
            }
          />
        ))}
        {flags.lkeHighAvailability && haPrice ? (
          <>
            <Divider spacingTop={16} />
            <HACheckbox
              checked={highAvailability}
              onChange={(e) => setHighAvailability(e.target.checked)}
              haPrice={haPrice}
            />
            <Divider spacingTop={16} />
          </>
        ) : null}
        {showWarning && (
          <Notice warning important text={nodeWarning} spacingTop={16} />
        )}
      </>
    </CheckoutBar>
  );
};

export default renderGuard(KubeCheckoutBar);
